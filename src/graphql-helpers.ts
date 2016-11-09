/// <reference types="typed-graphql" />
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInputType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLOutputType,
  GraphQLString,
  GraphQLScalarType,
} from 'graphql'
import * as joi from 'joi'
import {BuiltTypeDefinition, Query} from './entities'

/**
 * Typecheck to verify that [field] is a [Query]
 */
export function isQuery(field): field is Query {
  return !!(field as Query).resolve
}

/**
 * Typecheck to verify that [type] is a [BuiltTypeDefinition]
 */
export function isBuiltType(type): type is BuiltTypeDefinition<any> {
  return !!(type as BuiltTypeDefinition<any>).graphQLType
}

/**
 * Typecheck to verify that [type] is a [GraphQLScalarType]
 */
export function isScalarType(type): type is GraphQLScalarType {
  return !!type['_scalarConfig']
}

/**
 * Get a GraphQL input and output type, and (if possible) the builtType from a query
 */
export function getType(query: Query) {
  // : {builtType?: BuiltTypeDefinition<any>, graphQLType: GraphQLOutputType, graphQLInputType: GraphQLInputType}
  const isArray = Array.isArray(query.type)
  let type =
    isArray
      ? query.type[0]
      : query.type

  let builtType: BuiltTypeDefinition<any>
  let graphQLType: GraphQLOutputType
  let graphQLInputType: GraphQLInputType

  if (isScalarType(type)) {
    graphQLType = type
    graphQLInputType = graphQLType
  } else if (isBuiltType(type)) {
    builtType = type
    graphQLType = type.graphQLType
    graphQLInputType = type.graphQLInputType
  } else {
    throw Error(`Query type must be a builtType, an array with a built type or a graphql scalar type, got ${type}`)
  }

  if (isArray) {
    graphQLType =
      isArray
        ? new GraphQLList(graphQLType)
        : graphQLType
    graphQLInputType =
      isArray
        ? new GraphQLList(graphQLInputType)
        : graphQLInputType
  }

  return {builtType, graphQLType, graphQLInputType}
}

/**
 * Transforms a joi rule to a graphql type if possible
 */
export function joiToGraphQLType(joiSchema, name) {
  let type
  switch (joiSchema._type) {
    case 'array':
      if (joiSchema._inner.items.length !== 1) {
        throw `Array with multiple items in ${name} is not supported.
Please use a manual override by specifying args with a graphql type.`
      }
      type = new GraphQLList(joiToGraphQLType(joiSchema._inner.items[0], `${name}.array`))
      break
    case 'boolean':
      type = GraphQLBoolean
      break
    case 'number':
      type = (joiSchema._tests as any[]).some(test => test.name === 'integer')
        ? GraphQLInt
        : GraphQLFloat
      break
    case 'string':
      type = GraphQLString
      break
    default:
      throw `Type ${joiSchema._type} in ${name} is not supported.
Please use a manual override by specifying args with a graphql type.`
  }
  if (joiSchema._flags.presence === 'required') {
    type = new GraphQLNonNull(type)
  }
  return type
}

/**
 * Transforms a joi object rule to an graphql args object
 */
export function joiToArgs(args: Object, joiSchema: any, type) {
  if (!joiSchema._inner) {
    joiSchema = joi.object(joiSchema)
  }
  joiSchema._inner.children.forEach(({key, schema}: any) => {
    if (!args[key]) {
      args[key] = {key, type: joiToGraphQLType(schema, `${type.name}.${key}`)}
    }
  })
}

/**
 * validate [object] agains the joi [schema]
 */
export function joiValidate(object, schema) {
  return new Promise((resolve, reject) => {
    joi.validate(object, schema, (err, object) => {
      if (err) reject(err)
      else resolve(object)
    })
  })
}
