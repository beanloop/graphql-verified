declare module 'graphql-rule' {
  export type ModelAccessor<T> = T & {
    $data: T
    $props: any
    $context: any
    $parent: ModelAccessor<any>
    $root: ModelAccessor<any>
  }

  export type Rule<T> = boolean | ((model: ModelAccessor<T>) => boolean) | {
    /**
     * Whenever the property is allowed to be read
     *
     * Examples:
     *
     *  // always allow
     *  read: true
     *
     *  // always deny
     *  read: false
     *
     *  // allow access by admin or owner
     *  read: model => model.$props.isAdmin || model.$props.isOwner
     */
    read?: boolean | ((model: ModelAccessor<T>) => boolean)

    /**
     * Called when [key] was not allowed to be read
     *
     * Examples:
     *
     *  // returns null when read denied.
     *  readFail: null,
     *
     *  // throw an error when read is disallowed.
     *  readFail: () => { throw new Error('Access denied'); },
     */
    readFail?: (model: ModelAccessor<T>, key: string) => any
  }

  export type Model<T> = {
    name: string
    base?: ModelClass<any>
    props?: {
      [name: string]: (model: ModelAccessor<T>) => any
    }
    defaultRule?: Rule<T>
    rules?: {
      [name: string]: Rule<T>
    }
    interfaces?: Array<ModelClass<any>>
  }

  export interface ModelClass<T> {
    new (data: T, context?: any, parent?: ModelAccessor<any>): ModelAccessor<T>
  }

  const rule: {
    create<T>(rule: Model<T>): ModelClass<T>
    Model: ModelClass<any>,
  }

  export default rule
}
