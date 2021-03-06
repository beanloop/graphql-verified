import {
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLType,
} from 'graphql'
import {ModelAccessor, ModelClass, Rule} from 'graphql-rule'

export class AccessError extends Error {}

export type Type = GraphQLType | BuiltTypeDefinition<any>

export type Field = (Query|{type: GraphQLType, name?: string, description?: string}) & {isInput?: boolean}
export type FieldMap = {
  [name: string]: (() => Field)|Field
}

export interface TypeDefinition<T> {
  name: string
  description?: string

  props?: {
    [name: string]: (model: ModelAccessor<T>) => any
  }
  defaultReadRule?: Rule<any>
  selfRead?: Rule<any>
  readRules: false | {
    [name: string]: Rule<any>
  }
  defaultWriteRule?: Rule<any>
  selfWrite?: Rule<any>
  writeRules: false | {
    [name: string]: Rule<any>
  }

  fields: (() => FieldMap) | FieldMap
}

export interface BuiltTypeDefinition<T> extends TypeDefinition<T> {
  graphQLType: GraphQLOutputType
  graphQLInputType: GraphQLInputType
  readRuleModelClass?: ModelClass<T>
  writeRuleModelClass?: ModelClass<T>
}

export interface Query {
  type: Type|[Type],
  description?: string,
  validate?: any // joi.ObjectSchema
  args?: {[name: string]: any},

  // resolve: (source: any, args: any, context: any, info: GraphQLResolveInfo) => any
  resolve: (source: any, args: any, context: any, info: any) => any
}

export type MutationOptions = {
  props?: {
    [name: string]: (model: ModelAccessor<any>) => any
  }

  defaultWriteRule?: Rule<any>
  selfWrite?: Rule<any>
  writeRules: false | {
    [name: string]: Rule<any>
  }
}

export interface Mutation extends Query {}
