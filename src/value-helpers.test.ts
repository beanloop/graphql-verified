import {value} from './value-helpers'

describe('graphql', () => {
  describe('value-helpers', () => {
    describe('value', () => {
      it('should call a function', () => {
        expect(value((a, b) => a + b, 1, 2)).toBe(3)
      })
      it('should return a value', () => {
        expect(value(5, 1, 2)).toBe(5)
      })
    })
  })
})
