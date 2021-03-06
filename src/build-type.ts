import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from 'graphql'
import graphqlRule from 'graphql-rule'

import {buildQuery} from './build-query'
import {AccessError, BuiltTypeDefinition, FieldMap, TypeDefinition} from './entities'
import {getType, isBuiltType, isQuery, isScalarType} from './graphql-helpers'
import {failedSymbol, wrapRule} from './rule-helpers'

export function buildType<T>(definition: TypeDefinition<T>): BuiltTypeDefinition<T> {
  if (definition.readRules === undefined)
    throw Error('readRules is not specifed, set to false to disable')

  if (definition.writeRules === undefined)
    throw Error('writeRules is not specifed, set to false to disable')

  const fields =
    typeof definition.fields === 'function'
      ? definition.fields()
      : definition.fields
  const inputFields = {} as FieldMap

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
    }

    if (typeof field === 'function') {
      inputFields[prop] = field
    }
    else if (field.isInput || !(isQuery(field))) {
      const type = getType(field.type)

      inputFields[prop] = {
        type: type.graphQLInputType,
        name: field['name'],
        description: field.description,
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
              let value = await source[prop]
              if (value && (failedSymbol in value)) {
                return value[failedSymbol]
              }
            }
            return innerResolve(source, args, context, info)
          }
          wrappedQuery.resolve = resolve

          wrappedFields[prop] = wrappedQuery
        } else {
          const type = getType(field.type)

          wrappedFields[prop] = {
            type: type.graphQLType,
            name: field['name'],
            description: field.description,
          }
        }
      })

      return wrappedFields
    },
  })

  const graphQLInputType = new GraphQLInputObjectType({
    name: `${definition.name}Input`,
    description: definition.description,
    fields: () => {
      const wrappedFields = {}
      Object.entries(inputFields).forEach(([prop, field]) => {
        if (typeof field === 'function') {
          field = field()
          if (field.isInput || !(isQuery(field))) {
            const type = getType(field.type)

            wrappedFields[prop] = {
              type: type.graphQLInputType,
              name: field['name'],
              description: field.description,
            }
          }
        }
        else {
          wrappedFields[prop] = field
        }
      })
      return wrappedFields
    },
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
