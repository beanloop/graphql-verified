import {
  GraphQLList,
  GraphQLString,
} from 'graphql'

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
      expect(builtType.graphQLInputType['_typeConfig'].fields.targetGroups).not.toBeUndefined()
    })
  })
})
