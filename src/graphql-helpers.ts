/// <reference types="typed-graphql" />
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInputType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLString,
} from 'graphql'
import * as joi from 'joi'
import {BuiltTypeDefinition, Query, Type} from './entities'

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
export function getType(type: Type|[Type]): {builtType?: BuiltTypeDefinition<any>, graphQLType: GraphQLOutputType, graphQLInputType: GraphQLInputType} {
  type = type instanceof GraphQLList
    ? [type.ofType]
    : type
  const isArray = Array.isArray(type)
  type =
    isArray
      ? type[0]
      : type

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
    graphQLType = new GraphQLList(graphQLType)
    graphQLInputType = new GraphQLList(graphQLInputType)
  } else {
    graphQLType = graphQLType
    graphQLInputType = graphQLInputType
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
      type = (joiSchema._tests as Array<any>).some(test => test.name === 'integer')
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
 * validate [object] against the joi [schema]
 */
export function joiValidate(object, schema) {
  return new Promise((resolve, reject) => {
    joi.validate(object, schema, (err, object) => {
      if (err) reject(err)
      else resolve(object)
    })
  })
}
