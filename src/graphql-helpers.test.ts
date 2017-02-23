import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql'
import {GraphQLType} from 'graphql'
import * as joi from 'joi'
import {buildType} from './build-type'
import {getType, isScalarType, joiToArgs, joiValidate} from './graphql-helpers'

describe('graphql', () => {
  describe('graphql-helpers', () => {
    describe('isScalarType', () => {
      it('should accept GraphQLBoolean', () => {
        expect(isScalarType(GraphQLBoolean)).toBe(true)
      })
      it('should not accept GraphQLList', () => {
        expect(isScalarType(new GraphQLList(GraphQLBoolean))).toBe(false)
      })
    })

    describe('getType', () => {
      it('should support graphql types', () => {
        expect(getType(GraphQLBoolean)).toEqual({
          buildType: undefined,
          graphQLInputType: GraphQLBoolean,
          graphQLType: GraphQLBoolean,
        })
      })

      it('should support arrays of graphql types', () => {
        expect(getType([GraphQLBoolean])).toEqual({
          buildType: undefined,
          graphQLInputType: new GraphQLList(GraphQLBoolean),
          graphQLType: new GraphQLList(GraphQLBoolean),
        })
      })

      it('should support graphql lists of graphql types', () => {
        expect(getType(new GraphQLList(GraphQLBoolean))).toEqual({
          buildType: undefined,
          graphQLInputType: new GraphQLList(GraphQLBoolean),
          graphQLType: new GraphQLList(GraphQLBoolean),
        })
      })

      it('should support built types', () => {
        const builtType = buildType({
          name: 'Type',
          fields: {
            field: {type: GraphQLBoolean},
          },
          readRules: false,
          writeRules: false,
        })
        expect(getType(builtType)).toEqual({
          builtType,
          graphQLInputType: builtType.graphQLInputType,
          graphQLType: builtType.graphQLType,
        })
      })

      it('should support arrays of built types', () => {
        const builtType = buildType({
          name: 'Type',
          fields: {
            field: {type: GraphQLBoolean},
          },
          readRules: false,
          writeRules: false,
        })
        expect(getType([builtType])).toEqual({
          builtType,
          graphQLInputType: new GraphQLList(builtType.graphQLInputType),
          graphQLType: new GraphQLList(builtType.graphQLType),
        })
      })
    })

    describe('joiToArgs', () => {
      it('should convert to args', () => {
        const args = {}
        joiToArgs(args, {
          boolean: joi.boolean(),
          bool: joi.bool(),
          string: joi.string(),
          stringNonNull: joi.string().required(),
          number: joi.number(),
          integer: joi.number().integer(),
          array: joi.array().items(joi.string()),
          arrayNonNull: joi.array().items(joi.string().required()).required(),
        }, {name: 'Test'})
        expect(args).toEqual({
          boolean: {key: 'boolean', type: GraphQLBoolean},
          bool: {key: 'bool', type: GraphQLBoolean},
          string: {key: 'string', type: GraphQLString},
          stringNonNull: {key: 'stringNonNull', type: new GraphQLNonNull(GraphQLString)},
          number: {key: 'number', type: GraphQLFloat},
          integer: {key: 'integer', type: GraphQLInt},
          array: {key: 'array', type: new GraphQLList(GraphQLString)},
          arrayNonNull: {
            key: 'arrayNonNull',
            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
          },
        })
      })

      it('should throw on custom types', () => {
        expect(() => {
          joiToArgs({}, {
            object: joi.object(),
          }, {name: 'Test'})
        }).toThrow()
      })
    })

    describe('joiValidate', () => {
      it('should accept a valid object', () =>
        joiValidate({
          a: 'A',
          b: 42,
        }, joi.object({
          a: joi.string().required(),
          b: joi.number().integer(),
        }))
      )

      it('should not accept an invalid object', () =>
        joiValidate({
          a: 'A',
          b: '42',
        }, joi.object({
          c: joi.string().required(),
          d: joi.number().integer(),
        }))
          .catch(e => expect(e.message).toBe('child \"c\" fails because [\"c\" is required]'))
      )

      it('should apply neccecary changes', () =>
        joiValidate({
          b: '42',
        }, joi.object({
          a: joi.string().default('string'),
          b: joi.number().integer(),
        }))
          .then(object => expect(object).toEqual({
            a: 'string',
            b: 42,
          }))
      )
    })
  })
})
