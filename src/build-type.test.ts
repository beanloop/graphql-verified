/// <reference types="jest" />
import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  graphql,
} from 'graphql'
import 'regenerator-runtime/runtime'
import {buildQuery} from './build-query'
import {buildType} from './build-type'

describe('build-type', () => {
  describe('buildType', () => {
    it('should throw if readRules is not specifed', () => {
      expect(() => buildType({} as any))
        .toThrowError('readRules is not specifed, set to false to disable')
    })

    it('should throw if writeRules is not specifed', () => {
      expect(() => buildType({readRules: false} as any))
        .toThrowError('writeRules is not specifed, set to false to disable')
    })

    it('should support list in input types', () => {
      const builtType = buildType({
        name: 'Event',
        fields: {
          targetGroups: {type: new GraphQLList(GraphQLString)},
        },
        writeRules: false,
        readRules: false,
      })
      expect(builtType.graphQLInputType['_typeConfig'].fields().targetGroups).not.toBeUndefined()
    })

    it('should support promise results in rules', () => {
      const builtType = buildType({
        name: 'Type',
        fields: {
          prop: {type: GraphQLString},
        },
        writeRules: false,
        readRules: {
          prop: () => Promise.resolve(false)
        },
      })

      const query = buildQuery('getProp', {
        type: builtType,
        resolve() {
          return 'Hello'
        }
      })

      const QueryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({getProp: query}),
      })

      const schema = new GraphQLSchema({
        query: QueryType,
      })

      return graphql(schema, `
        query getProp {
          getProp {
            prop
          }
        }
      `)
        .then(result => {
          expect(result).toEqual({data: {getProp: {prop: null}}})
        })
    })

    it('should support promise results in rules for function fields', () => {
      const builtType = buildType({
        name: 'Type2',
        fields: {
          prop: () => ({
            type: GraphQLString,
            resolve: _ => 'Hello function'
          }),
        },
        writeRules: false,
        readRules: {
          prop: () => Promise.resolve(false)
        },
      })

      const query = buildQuery('getProp', {
        type: builtType,
        resolve() {
          return 'Hello'
        }
      })

      const QueryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({getProp: query}),
      })

      const schema = new GraphQLSchema({
        query: QueryType,
      })

      return graphql(schema, `
        query getProp {
          getProp {
            prop
          }
        }
      `)
        .then(result => {
          expect(result).toEqual({data: {getProp: {prop: null}}})
        })
    })
  })
})
