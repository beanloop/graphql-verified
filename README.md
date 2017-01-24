# graphql-verified

This package combines [graphql-rule](https://github.com/joonhocho/graphql-rule) with [joi](https://github.com/hapijs/joi) 
for simple authorization and verfication of graphql apis.

## Usage

### Build types
First, you need to create the types. In a type you specify the normal graphql fields as well as
read and write rules for that type.

```js
import {buildType} from 'graphql-verified'

const admin = model => model.$props.isAdmin
const assignedOrAdmin = model => model.$props.isAdmin || model.$props.isAssigned
const ownerOrAdmin = model => model.$props.isAdmin || model.$props.isOwner

export const ContactPersonType = buildType({
  name: 'ContactPerson',
  fields: {
    id: {type: GraphQLString},
    name: {type: GraphQLString},
    email: {type: GraphQLString},
    phone: {type: GraphQLString},
    image: {type: GraphQLString},
  },
  /// props are used by the rules to determine if an object is allowed or denied
  props: {
    isAdmin: model => model.$context.auth.isAdmin,
    isAssigned: isOwnerOf('Company'),
  },
  /// selfRead is a special read rule that specifies if the object can be read at all
  /// in queries and mutations. If selfRead is denied and the object is returned by itself
  /// it will be returned as null and if the object is returned as an element in a list
  /// it will be removed from the list.
  /// selfRead can be omitted which is the same as specifying `selfRead: true`. Anyone can then
  /// read the object, but the readRules will determine what properties can be read.
  selfRead: assignedOrAdmin,
  // Read rules specifies which properties can be read in queries and mutations
  readRules: {
    id: assignedOrAdmin,
    name: assignedOrAdmin,
    email: assignedOrAdmin,
    phone: assignedOrAdmin,
    image: assignedOrAdmin,
  },
  /// Write rules specifies which properties can be passed when the type is used as an 
  /// argument in a mutation
  writeRules: {
    id: admin,
    name: admin,
    email: admin,
    phone: admin,
    image: admin,
  },
})

const CompanyType = buildType({
  name: 'Company',
  fields: {
    id: {type: GraphQLString},
    name: {type: GraphQLString},
    orgNumber: {type: GraphQLString},
    contactPersonId: {type: GraphQLString},
    contactPerson: () => ({
      type: ContactPersonType,
      /// As this resolve does not take arguments, pass false to disable joi validations
      validate: false,
      resolve({$data: {contactPersonId}}, _, {contactPersonLoader}) {
        return contactPersonLoader.load(contactPersonId)
      },
    }),
  },
  props: {
    isAdmin: model => model.$context.auth.isAdmin,
    isOwner: model => model.$context.auth.companyId === model.$data.id,
  }),
  readRules: {
    id: true,
    /// true allows anyone to read the property
    name: true,
    contactPerson: true,
    orgNumber: ownerOrAdmin,
  },
  writeRules: {
    id: ownerOrAdmin,
    name: ownerOrAdmin,
    orgNumber: ownerOrAdmin,
    contactPersonId: ownerOrAdmin,
  },
})
```

### Create Queries

```js
import {buildQueries} from 'graphql-verified'
import * as joi from 'joi'

export const contactPersonQueries = buildQueries({
  contactPersons: {
    /// A type in array brackets specifies the return type to be an array of that type
    type: [ContactPersonType],
    /// As this resolve does not take the args argument, joi validations does not have
    /// to be disabled explicitly
    resolve() {
      return ContactPerson.findAll()
    },
  },
})


export const companyQueries = buildQueries({
  getCompany: {
    type: CompanyType,
    validate: joi.object({
      id: joi.string().required(),
    }),
    resolve(_, {id}, {companyLoader}) {
      return companyLoader.load(id)
    },
  },
  companies: {
    type: [CompanyType],
    resolve() {
      return Company.findAll()
    },
  },
})
```

### Create Mutations

```js
import {buildMutations} from 'graphql-verified'
import * as joi from 'joi'

export const companyMutations = buildMutations({
  upsertCompany: {
    type: CompanyType,
    validate: joi.object({
      company: {
        id: joi.string().optional(),
        name: joi.string().required(),
        orgNumber: joi.string().required(),
        contactPersonId: joi.string().guid().required(),
      },
    }),
    /// In most cases the type of args are figured out automatically from the joi validations
    /// but for complex arguments, for example a built type, that fails and the type must be 
    /// specified manually
    args: {
      company: {type: CompanyType},
    },
    resolve(_, {company}) {
      return companyLoader.load(id)
    },
  },
  deleteCompany: {
    type: CompanyType,
    validate: joi.object({
      id: joi.string().required(),
    }),
    resolve(_, {id}) {
      return Company.delete({where: {id}})
    },
  },
})
```

### Build your schema
The schema is built using normal [graphql-js](https://github.com/graphql/graphql-js) APIs.

```js
import {GraphQLObjectType, GraphQLSchema} from 'graphql'

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => Object.assign({},
    contactPersonQueries,
    companyQueries,
  )
})

const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: () => Object.assign({},
    companyMutations,
  ),
})

const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType
})
```

### External documentation
For further documentation on rules and props, please see [graphql-rule](https://github.com/joonhocho/graphql-rule).  
For further documentation on validation options, please see [joi](https://github.com/hapijs/joi/blob/v10.2.0/API.md).  