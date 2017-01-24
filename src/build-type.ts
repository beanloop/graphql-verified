import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from 'graphql'
import graphqlRule from 'graphql-rule'

import {AccessError, BuiltTypeDefinition, TypeDefinition} from './entities'
import {isQuery, isScalarType, isBuiltType} from './graphql-helpers'
import {wrapRule, failedSymbol} from './rule-helpers'
import {buildQuery} from './build-query'

export function buildType<T>(definition: TypeDefinition<T>): BuiltTypeDefinition<T> {
  if (definition.readRules === undefined)
    throw Error('readRules is not specifed, set to false to disable')

  if (definition.writeRules === undefined)
    throw Error('writeRules is not specifed, set to false to disable')

  const fields =
    typeof definition.fields === 'function'
      ? definition.fields()
      : definition.fields
  const inputFields = {}

  const readRules = {}

  Object.entries(fields).forEach(([prop, field]) => {
    /// A function field may be a query so treat it as one as it will otherwise go unchecked
    if (isQuery(field) || typeof field === 'function') {
      // If there are read rules, wrap the query read rule to return failValue
      if (definition.readRules) {
        readRules[prop] = wrapRule(definition.readRules[prop])
      }
    } else {
      // if there is a read rule for this prop
      if (definition.readRules && definition.readRules[prop] !== undefined) {
        readRules[prop] = definition.readRules[prop]
      }

      if (isScalarType(field.type) || field.type['ofType'] && isScalarType(field.type['ofType'])) {
        inputFields[prop] = field
      } else if (isBuiltType(field.type)) {
        inputFields[prop] = {
          type: field.type.graphQLInputType,
          name: field.name,
          description: field.description,
        }
      }
    }
  })

  const graphQLType = new GraphQLObjectType({
    name: definition.name,
    description: definition.description,
    fields: () => {
      const wrappedFields = {}

      Object.entries(fields).forEach(([prop, field]) => {
        if (typeof field === 'function') {
          field = field()
        }

        if (!field.type) {
          throw Error(`Type is ${field.type} for field ${definition.name}.${prop}`)
        }

        if (isQuery(field)) {
          let wrappedQuery = buildQuery(prop, field)

          const innerResolve = wrappedQuery.resolve
          async function resolve(source, args, context, info) {
            if (definition.readRules) {
              let value = source[prop]
              if (value && (failedSymbol in value)) {
                return value[failedSymbol]
              }
            }
            return innerResolve(source, args, context, info)
          }
          wrappedQuery.resolve = resolve

          wrappedFields[prop] = wrappedQuery
        } else {
          wrappedFields[prop] = field
        }
      })

      return wrappedFields
    },
  })

  const graphQLInputType = new GraphQLInputObjectType({
    name: `${definition.name}Input`,
    description: definition.description,
    fields: inputFields,
  })

  const readRuleModelClass = definition.readRules && graphqlRule.create({
    name: `${definition.name}_Read`,
    props: definition.props,
    defaultRule: definition.defaultReadRule,
    rules: readRules,
  })
  const defaultWriteRule =
    'defaultWriteRule' in definition
      ? definition.defaultWriteRule
      : {readFail(_, key) {
          throw new AccessError(`No access to set ${definition.name}.${key}`)
        }}
  const writeRuleModelClass = definition.writeRules && graphqlRule.create({
    name: `${definition.name}_Write`,
    props: definition.props,
    defaultRule: defaultWriteRule,
    rules: definition.writeRules,
  })

  return Object.assign({}, definition, {
    graphQLType,
    graphQLInputType,
    readRuleModelClass,
    defaultWriteRule,
    writeRuleModelClass,
  })
}
