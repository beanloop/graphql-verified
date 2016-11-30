import {GraphQLFieldConfigMap, GraphQLFieldConfig} from 'graphql'
import graphqlRule from 'graphql-rule'

import {Mutation, MutationOptions, AccessError} from './entities'
import {getType, joiToArgs, joiValidate} from './graphql-helpers'
import {applyReadRules, applyWriteRules} from './rule-helpers'

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
