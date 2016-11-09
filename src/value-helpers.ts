if (!Array.prototype.some) {
  Array.prototype.some = function (predicate: (value, index, array) => boolean) {
    for (let i = 0; i < this.length; i++) {
      if (predicate(this[i], i, this)) return true
    }

    return false
  }
}

/**
 * If [value] is a function, call it with [args] and return the result,
 * else return [value] directly.
 */
export function value(value, ...args) {
  return typeof value === 'function'
    ? value(...args)
    : value
}

/**
 * If [data] is an Array, map [fn] over it and filter out falsy values, awaiting promises.
 * Else apply [fn] with [data].
 */
export function filterMap(fn, data) {
  if (Array.isArray(data)) {
    return Promise.all(data.map(fn))
      .then(models => models.filter(model => !!model))
  }
  return fn(data)
}
