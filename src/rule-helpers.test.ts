import Rule from 'graphql-rule'
import {isOwnerOf} from './rule-helpers'

describe('rule-helpers', () => {
  const ownerClass = Rule.create({
    name: 'Owner_Read',
    props: {
      isOwner: () => true
    },
  })

  const notOwnerClass = Rule.create({
    name: 'NotOwner_Read',
    props: {
      isOwner: () => false
    },
  })

  describe('isOwnerOf', () => {
    it('should return false if there are no parent', () => {
      expect(isOwnerOf('Owner')(new ownerClass({}))).toBe(false)
    })

    it('should return false if there are no such parent', () => {
      expect(isOwnerOf('Owner')(new ownerClass({}, null, new notOwnerClass({})))).toBe(false)
    })

    it('should return false if the parent is not an owner', () => {
      expect(isOwnerOf('NotOwner')(new ownerClass({}, null, new notOwnerClass({})))).toBe(false)
    })

    it('should return true if the parent is an owner', () => {
      expect(isOwnerOf('Owner')(new ownerClass({}, null, new ownerClass({})))).toBe(true)
    })
  })
})