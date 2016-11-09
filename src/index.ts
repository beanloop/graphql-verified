import graphqlRule from 'graphql-rule'
import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from 'graphql'
import {BuiltTypeDefinition, Query, Mutation, MutationOptions, TypeDefinition} from './entities'
import {
  getType,
  isBuiltType,
  isQuery,
  isScalarType,
  joiToArgs,
  joiValidate,
} from './graphql-helpers'
import {
  applyReadRules,
  applyWriteRules,
  failedSymbol,
  wrapRule,
} from './rule-helpers'

export {failedSymbol}

export class AccessError extends Error {}

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

      if (isScalarType(field.type)) {
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

/**
 * Builds a graphql query using joi validations to specify (and valdiate) args
 *
 * Example:
 *
 *    const queries = buildQueries(GraphQLString, {
 *      getGreeting: {
 *        validate: {
 *          name: joi.string().default('World'),
 *        },
 *        resolve: (_, {name}) => `Hello, ${name}!`,
 *      },
 *    })
 */
export function buildQueries(queries: {[name: string]: Query}): GraphQLFieldConfigMap {
  const built = {}
  Object.entries(queries).forEach(([name, query]) => {
    built[name] = buildQuery(name, query)
  })
  return built
}

export function buildQuery(name: string, query: Query): GraphQLFieldConfig {
  const args = Object.assign({}, query.args)
  const {builtType, graphQLType} = getType(query)

  if (query.validate === undefined && query.resolve.length > 1)
    throw Error(`validate is not specifed for query ${name}, set to false to disable`)

  if (builtType && query.validate) {
    joiToArgs(args, query.validate, builtType)
  }

  return {
    type: graphQLType,
    description: query.description,
    args,
    async resolve(source, args, context, info) {
      if (query.validate) {
        args = await joiValidate(args, query.validate)
      }

      const parent =
        source instanceof graphqlRule.Model
          ? source
          : null

      return applyReadRules(
        builtType,
        await query.resolve(source, args, context, info),
        parent,
        context,
      )
    },
  }
}

export function buildMutations(
  mutations: {[name: string]: Mutation & MutationOptions},
  options: MutationOptions = {} as any
): GraphQLFieldConfigMap {
  const built = {}
  Object.entries(mutations).forEach(([name, query]) => {
    built[name] = buildMutation(name, query, Object.assign({}, options, query))
  })
  return built
}

export function buildMutation(name: string, query: Mutation, options: MutationOptions): GraphQLFieldConfig {
  const args = Object.assign({}, query.args)
  const argTypes = {}
  Object.entries(args).forEach(([name, type]) => {
    const {graphQLInputType, builtType} = getType(type)
    if (builtType) {
      args[name] = {type: graphQLInputType}
      argTypes[name] = builtType
    }
  })
  const {builtType, graphQLType} = getType(query)

  if (query.validate === undefined)
    throw Error(`validate is not specifed for mutation ${name}, set to false to disable`)

  if (options.writeRules === undefined)
    throw Error(`writeRules is not specifed for mutation ${name}, set to false to disable`)

  const defaultWriteRule =
    options.defaultWriteRule ||
    (builtType && builtType.defaultWriteRule) ||
    ('defaultWriteRule' in query
      ? options.defaultWriteRule
      : {readFail(_, key) {
          throw new AccessError(`No access to mutation ${name}.${key}`)
        }})
  const writeRuleModelClass = options.writeRules && graphqlRule.create({
    name: `${name}_Mutation`,
    props: options.props || (builtType && builtType.props),
    defaultRule: defaultWriteRule,
    rules: options.writeRules,
  })
  const selfWrite = options.selfWrite || (builtType && builtType.selfWrite)

  if (query.validate) {
    joiToArgs(args, query.validate, builtType)
  }

  return {
    type: graphQLType,
    description: query.description,
    args,
    async resolve(source, args, context, info) {
      const parent =
        source instanceof graphqlRule.Model
          ? source
          : null

      args = await applyWriteRules(
        writeRuleModelClass,
        selfWrite,
        defaultWriteRule,
        argTypes,
        args,
        parent,
        context,
      )
      if (!args) return null

      if (query.validate) {
        args = await joiValidate(args, query.validate)
      }

      return applyReadRules(
        builtType,
        await query.resolve(source, args, context, info),
        parent,
        context,
      )
    },
  }
}
