import type Data from "std.data"
import type Definition from "std.data.definition"
import type Meta from "std.data.meta"
import type Portability from "std.data.portability"
import { data, definition, fn, meta } from "./extern.js"

export function createDefaultFormat(metaspace: Meta.Space): Portability.Format<Portability.JSON> {
  return new DefaultFormat(metaspace)
}

// ----------------------------------------------------------------------------------------------------------------- //
class DefaultFormat implements Portability.Format<Portability.JSON> {
  readonly #metaspace: Meta.Space
  #unmarshallListValue(listType: Meta.Type<Data.List<Data.Value>>, payload: Portability.JSON[]): Data.List<Data.Value> {
    const [elementaryExpression] = this.#metaspace.unevaluate(listType.match(elementaryType))
    const members = payload.map(payloadMember => this.unmarshall(payloadMember, elementaryExpression))
    return data.list(listType, members)
  }
  #unmarshallTupleValue(
    tupleType: Meta.Type<Data.Tuple<Data.ValueSequence>>,
    payload: Portability.JSON[]
  ): Data.Tuple<Data.ValueSequence> {
    if (payload.length < 2) {
      throw new Error("a tuple payload must have at least two elements")
    }
    const memberTypes = tupleType.match(tupleTypes)
    const members = payload.map((member, i) => {
      const [memberExpression] = this.#metaspace.unevaluate(memberTypes[i])
      return this.unmarshall(member, memberExpression)
    })
    return data.tuple(tupleType, members as Data.ValueSequence)
  }
  #unmarshallDictionaryValue(
    dictionaryType: Meta.Type<Data.Dictionary<Data.Value>>,
    payload: { [key: string]: Portability.JSON }
  ): Data.Dictionary<Data.Value> {
    const [elementaryExpression] = this.#metaspace.unevaluate(dictionaryType.match(elementaryType))
    const dictionaryMembers: { [key: string]: Data.Value } = {}
    for (const key in payload) {
      dictionaryMembers[key] = this.unmarshall(payload[key], elementaryExpression)
    }
    return data.dictionary(dictionaryType, dictionaryMembers)
  }
  #unmarshallRecordValue(
    recordType: Meta.Type<Data.Record<Data.FieldValues>>,
    payload: { [key: string]: Portability.JSON }
  ): Data.Record<Data.FieldValues> {
    const fieldTypes = recordType.match(recordFieldTypes)
    const fieldValues: { [key: string]: Data.Value } = {}
    for (const key in fieldTypes) {
      const [fieldExpression] = this.#metaspace.unevaluate(fieldTypes[key])
      fieldValues[key] = this.unmarshall(payload[key], fieldExpression)
    }
    return data.record(recordType, fieldValues)
  }
  constructor(metaspace: Meta.Space) {
    this.#metaspace = metaspace
  }
  get metaspace() {
    return this.#metaspace
  }
  marshall(value: Data.Value, expressionSource: Definition.TypeExpression | string = "*?"): Portability.JSON {
    switch (typeof value) {
      case "boolean":
      case "number":
      case "string":
        // basic value remains what it is
        return value
      case "undefined":
        // but undefined becomes null
        return null
    }
    const expression =
      typeof expressionSource === "string" ? definition.parseTypeExpression(expressionSource) : expressionSource
    const contextualType = this.#metaspace.evaluate(expression)
    // determine composition type
    if (data.isRecord(value)) {
      const recordType = value.type as Meta.Type<Data.Record<Data.FieldValues>>
      const fieldTypes = recordType.match(recordFieldTypes)
      const payloadFields: { [key: string]: Portability.JSON } = {}
      for (const [fieldName, fieldValue] of value.associations) {
        // skip undefined fields
        if (fieldValue !== void 0) {
          const [fieldExpression] = this.#metaspace.unevaluate(fieldTypes[fieldName])
          payloadFields[fieldName] = this.marshall(fieldValue, fieldExpression)
        }
      }
      if (!meta.equalType(contextualType, recordType)) {
        const [recordExpression] = this.#metaspace.unevaluate(recordType)
        // rich payload with $ and defined fields
        payloadFields.$ = recordExpression.text
      }
      return payloadFields
    } else if (data.isTuple(value)) {
      const tupleType = value.type as Meta.Type<Data.Tuple<Data.ValueSequence>>
      const memberTypes = tupleType.match(tupleTypes)
      const payloadMembers = [
        ...value.associations.map(([ix, member]) => {
          const [memberExpression] = this.#metaspace.unevaluate(memberTypes[ix - 1])
          return this.marshall(member, memberExpression)
        }),
      ]
      if (meta.equalType(contextualType, tupleType)) {
        // payload is a simple array (no need for type info)
        return payloadMembers
      } else {
        // rich payload with $ and _
        const [tupleExpression] = this.#metaspace.unevaluate(tupleType)
        return { $: tupleExpression.text, _: payloadMembers }
      }
    } else if (data.isList(value)) {
      const listType = value.type as Meta.Type<Data.List<Data.Value>>
      const [elementaryExpression] = this.#metaspace.unevaluate(listType.match(elementaryType))
      const payloadMembers = [...value.members.map(member => this.marshall(member, elementaryExpression))]
      if (meta.equalType(contextualType, listType)) {
        // payload is a simple array (no need for type info)
        return payloadMembers
      } else {
        const [listExpression] = this.#metaspace.unevaluate(listType)
        // rich payload with $ and _
        return { $: listExpression.text, _: payloadMembers }
      }
    } else if (data.isDictionary(value)) {
      const dictionaryType = value.type as Meta.Type<Data.Dictionary<Data.Value>>
      const [elementaryExpression] = this.#metaspace.unevaluate(dictionaryType.match(elementaryType))
      const payloadAssociations: { [key: string]: Portability.JSON } = {}
      for (const [key, member] of value.associations) {
        payloadAssociations[key] = this.marshall(member, elementaryExpression)
      }
      const payload: { [key: string]: Portability.JSON } = { _: payloadAssociations }
      if (!meta.equalType(contextualType, dictionaryType)) {
        const [dictionaryExpression] = this.#metaspace.unevaluate(dictionaryType)
        // rich payload with type info
        payload.$ = dictionaryExpression.text
      }
      return payload
    } else {
      throw new Error("expected value to marshall")
    }
  }
  unmarshall(payload: Portability.JSON, expressionSource: Definition.TypeExpression | string = "*?"): Data.Value {
    switch (typeof payload) {
      case "boolean":
      case "number":
      case "string":
        // basic payload remains what it is
        return payload
    }
    // but null becomes undefined
    if (payload === null) {
      return void 0
    }
    const expression =
      typeof expressionSource === "string" ? definition.parseTypeExpression(expressionSource) : expressionSource
    const contextualType = this.#metaspace.evaluate(expression)
    if (Array.isArray(payload)) {
      // array payload results in either a list or a tuple
      if (contextualType.match(isListType)) {
        return this.#unmarshallListValue(contextualType as Meta.Type<Data.List<Data.Value>>, payload)
      } else if (contextualType.match(isTupleType)) {
        return this.#unmarshallTupleValue(contextualType as Meta.Type<Data.Tuple<Data.ValueSequence>>, payload)
      } else {
        throw new Error("expected list or tuple type for an array payload")
      }
    } else if ("$" in payload && "_" in payload) {
      // rich payload with $ and _
      const type = this.#metaspace.evaluate(payload.$ as string)
      if (Array.isArray(payload._)) {
        // nested array results in either a list or a tuple
        const payloadMembers = payload._
        if (type.match(isListType)) {
          return this.#unmarshallListValue(type as Meta.Type<Data.List<Data.Value>>, payloadMembers)
        } else if (type.match(isTupleType)) {
          return this.#unmarshallTupleValue(type as Meta.Type<Data.Tuple<Data.ValueSequence>>, payloadMembers)
        } else {
          throw new Error("expected list or tuple type for a nested array payload")
        }
      } else if (type.match(isDictionaryType)) {
        return this.#unmarshallDictionaryValue(
          type as Meta.Type<Data.Dictionary<Data.Value>>,
          payload._ as { [key: string]: Portability.JSON }
        )
      } else {
        throw new Error("unable to unmarshall invalid nested payload")
      }
    } else if ("$" in payload) {
      // rich payload with record fields
      const type = this.#metaspace.evaluate(payload.$ as string)
      if (type.match(isRecordType)) {
        return this.#unmarshallRecordValue(type as Meta.Type<Data.Record<Data.FieldValues>>, payload)
      } else {
        throw new Error("expected record type for payload")
      }
    } else if ("_" in payload) {
      if (contextualType.match(isDictionaryType)) {
        return this.#unmarshallDictionaryValue(
          contextualType as Meta.Type<Data.Dictionary<Data.Value>>,
          payload._ as { [key: string]: Portability.JSON }
        )
      } else {
        throw new Error("expected dictionary type for payload")
      }
    } else if (contextualType.match(isRecordType)) {
      return this.#unmarshallRecordValue(contextualType as Meta.Type<Data.Record<Data.FieldValues>>, payload)
    } else {
      throw new Error("unable to unmarshall invalid payload")
    }
  }
}
const recordFieldTypes: Meta.TypePattern<Meta.FieldTypesOf<Data.FieldValues>, []> = {
  record(_type, _parameters, fieldTypes) {
    return fieldTypes
  },
  orelse() {
    throw new Error("expected a record type")
  },
}
const tupleTypes: Meta.TypePattern<Meta.Type<Data.Value>[], []> = {
  tuple(_type, _parameters, types) {
    return types as Meta.Type<Data.Value>[]
  },
  orelse() {
    throw new Error("expected a tuple type")
  },
}
const elementaryType: Meta.TypePattern<Meta.Type<Data.Value>, []> = {
  list(_type, _parameters, elementary) {
    return elementary
  },
  dictionary(_type, _parameters, elementary) {
    return elementary
  },
  orelse() {
    throw new Error("expected a list or dictionary type")
  },
}
const isListType: Meta.TypePattern<boolean, []> = { list: fn.returnTrue, orelse: fn.returnFalse }
const isDictionaryType: Meta.TypePattern<boolean, []> = { dictionary: fn.returnTrue, orelse: fn.returnFalse }
const isRecordType: Meta.TypePattern<boolean, []> = { record: fn.returnTrue, orelse: fn.returnFalse }
const isTupleType: Meta.TypePattern<boolean, []> = { tuple: fn.returnTrue, orelse: fn.returnFalse }
