import {ModelClass, Rule} from 'graphql-rule'
import {BuiltTypeDefinition} from './entities'
import {filterMap, value} from './value-helpers'

export const failedSymbol = Symbol('failed')

/**
 * Wraps a graphql-rule rule to return {[failedSymbol]: originalValue} on fail
 */
export function wrapRule(rule: Rule<any>) {
  let userReadFail
  if (typeof rule === 'object') {
    userReadFail = rule.readFail
    rule = rule.read
  }

  return {
    read: rule === undefined ? false : rule,
    readFail(model, key) {
      let failValue = null
      if (typeof userReadFail === 'function') {
        failValue = userReadFail(model, key)
      }
      else if (userReadFail !== undefined) {
        failValue = userReadFail
      }
      return {[failedSymbol]: failValue}
    },
  }
}

export const applyRules = (
  modelClass: ModelClass<any>,
  selfRule: Rule<any>,
  defaultRule: Rule<any>,
  context,
  parent,
) => async (object) => {
  if (!modelClass && !selfRule) return object

  const model =
    modelClass
      ? new modelClass(object, context, parent)
      : Object.assign({}, object, {$context: context})

  if (selfRule) {
    const canRead = await value(selfRule, model)

    if (!canRead) {
      return defaultRule
        ? (defaultRule['readFail'] ? value(defaultRule['readFail'], model) : value(defaultRule, model))
        : null
    }
  }

  return model
}

export async function applyReadRules(type: BuiltTypeDefinition<any>, object, parent, context) {
  if (object && type) {
    return filterMap(applyRules(
      type.readRuleModelClass,
      type.selfRead,
      type.defaultReadRule,
      context,
      parent
    ), object)
  }
  return object
}

export async function applyWriteRules(
  writeRuleModelClass: ModelClass<any>,
  selfWrite: Rule<any>,
  defaultWriteRule: Rule<any>,
  argTypes: {[name: string]: BuiltTypeDefinition<any>},
  object, parent, context,
) {
  if (object && writeRuleModelClass) {

    let writeModel = await applyRules(
      writeRuleModelClass,
      selfWrite,
      defaultWriteRule,
      context,
      parent
    )(object)

    if (!writeModel) return writeModel

    const validatedObject = {}
    for (const key of Object.keys(writeModel.$data)) {
      let valueToSet = await writeModel[key]
      if (valueToSet !== null) {
        if (argTypes[key]) {
          if (Array.isArray(valueToSet)) {
            valueToSet = await Promise.all(valueToSet.map(valueToSet => applyWriteRules(
              argTypes[key].writeRuleModelClass,
              argTypes[key].selfWrite,
              argTypes[key].defaultWriteRule,
              argTypes,
              valueToSet,
              /* parent */ writeModel,
              context,
            )))
          } else {
            valueToSet = await applyWriteRules(
              argTypes[key].writeRuleModelClass,
              argTypes[key].selfWrite,
              argTypes[key].defaultWriteRule,
              argTypes,
              valueToSet,
              /* parent */ writeModel,
              context,
            )
          }
        }
        validatedObject[key] = valueToSet
      }
    }

    return validatedObject
  }
  return object
}

/**
 * Sets isOwner if the parent type of typeName isOwner
 */
export const isOwnerOf = typeName => model => {
  if (!model.$parent) return false
  const parent = model.$parentOfType(`${typeName}_Read`)
  return !!(parent && parent.$props.isOwner )
}
