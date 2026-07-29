import type Data from "std.data"
import { fn } from "../extern.js"
import { parseTypeExpression } from "./definition.js"
import { equalType } from "./type.js"
import { dictionary, isDictionary, isList, isRecord, isTuple, list, record, tuple } from "./value.js"

export function createFormatJSON(dataspace: Data.Space): Data.Format<Data.JSON> {
  return new DefaultFormat(dataspace)
}

// ----------------------------------------------------------------------------------------------------------------- //
class DefaultFormat implements Data.Format<Data.JSON> {
  readonly #dataspace: Data.Space
  #unmarshallListValue(listType: Data.Type<Data.List<Data.Value>>, payload: Data.JSON[]): Data.List<Data.Value> {
    const [elementaryExpression] = this.#dataspace.unevaluate(listType.match(elementaryType))
    const members = payload.map(payloadMember => this.unmarshall(payloadMember, elementaryExpression))
    return list(listType, members)
  }
  #unmarshallTupleValue(
    tupleType: Data.Type<Data.Tuple<Data.ValueSequence>>,
    payload: Data.JSON[]
  ): Data.Tuple<Data.ValueSequence> {
    if (payload.length < 2) {
      throw new Error("a tuple payload must have at least two elements")
    }
    const memberTypes = tupleType.match(tupleTypes)
    const members = payload.map((member, i) => {
      const [memberExpression] = this.#dataspace.unevaluate(memberTypes[i])
      return this.unmarshall(member, memberExpression)
    })
    return tuple(tupleType, members as Data.ValueSequence)
  }
  #unmarshallDictionaryValue(
    dictionaryType: Data.Type<Data.Dictionary<Data.Value>>,
    payload: { [key: string]: Data.JSON }
  ): Data.Dictionary<Data.Value> {
    const [elementaryExpression] = this.#dataspace.unevaluate(dictionaryType.match(elementaryType))
    const dictionaryMembers: { [key: string]: Data.Value } = {}
    for (const key in payload) {
      dictionaryMembers[key] = this.unmarshall(payload[key], elementaryExpression)
    }
    return dictionary(dictionaryType, dictionaryMembers)
  }
  #unmarshallRecordValue(
    recordType: Data.Type<Data.Record<Data.FieldValues>>,
    payload: { [key: string]: Data.JSON }
  ): Data.Record<Data.FieldValues> {
    const fieldTypes = recordType.match(recordFieldTypes)
    const fieldValues: { [key: string]: Data.Value } = {}
    for (const key in fieldTypes) {
      const [fieldExpression] = this.#dataspace.unevaluate(fieldTypes[key])
      fieldValues[key] = this.unmarshall(payload[key], fieldExpression)
    }
    return record(recordType, fieldValues)
  }
  constructor(dataspace: Data.Space) {
    this.#dataspace = dataspace
  }
  get dataspace() {
    return this.#dataspace
  }
  marshall(value: Data.Value, expressionSource: Data.TypeExpression | string = "*?"): Data.JSON {
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
    const expression = typeof expressionSource === "string" ? parseTypeExpression(expressionSource) : expressionSource
    const contextualType = this.#dataspace.evaluate(expression)
    // determine composition type
    if (isRecord(value)) {
      const recordType = value.type as Data.Type<Data.Record<Data.FieldValues>>
      const fieldTypes = recordType.match(recordFieldTypes)
      const payloadFields: { [key: string]: Data.JSON } = {}
      for (const [fieldName, fieldValue] of value.associations) {
        // skip undefined fields
        if (fieldValue !== void 0) {
          const [fieldExpression] = this.#dataspace.unevaluate(fieldTypes[fieldName])
          payloadFields[fieldName] = this.marshall(fieldValue, fieldExpression)
        }
      }
      if (!equalType(contextualType, recordType)) {
        const [recordExpression] = this.#dataspace.unevaluate(recordType)
        // rich payload with $ and defined fields
        payloadFields.$ = recordExpression.text
      }
      return payloadFields
    } else if (isTuple(value)) {
      const tupleType = value.type as Data.Type<Data.Tuple<Data.ValueSequence>>
      const memberTypes = tupleType.match(tupleTypes)
      const payloadMembers = [
        ...value.associations.map(([ix, member]) => {
          const [memberExpression] = this.#dataspace.unevaluate(memberTypes[ix - 1])
          return this.marshall(member, memberExpression)
        }),
      ]
      if (equalType(contextualType, tupleType)) {
        // payload is a simple array (no need for type info)
        return payloadMembers
      } else {
        // rich payload with $ and _
        const [tupleExpression] = this.#dataspace.unevaluate(tupleType)
        return { $: tupleExpression.text, _: payloadMembers }
      }
    } else if (isList(value)) {
      const listType = value.type as Data.Type<Data.List<Data.Value>>
      const [elementaryExpression] = this.#dataspace.unevaluate(listType.match(elementaryType))
      const payloadMembers = [...value.members.map(member => this.marshall(member, elementaryExpression))]
      if (equalType(contextualType, listType)) {
        // payload is a simple array (no need for type info)
        return payloadMembers
      } else {
        const [listExpression] = this.#dataspace.unevaluate(listType)
        // rich payload with $ and _
        return { $: listExpression.text, _: payloadMembers }
      }
    } else if (isDictionary(value)) {
      const dictionaryType = value.type as Data.Type<Data.Dictionary<Data.Value>>
      const [elementaryExpression] = this.#dataspace.unevaluate(dictionaryType.match(elementaryType))
      const payloadAssociations: { [key: string]: Data.JSON } = {}
      for (const [key, member] of value.associations) {
        payloadAssociations[key] = this.marshall(member, elementaryExpression)
      }
      const payload: { [key: string]: Data.JSON } = { _: payloadAssociations }
      if (!equalType(contextualType, dictionaryType)) {
        const [dictionaryExpression] = this.#dataspace.unevaluate(dictionaryType)
        // rich payload with type info
        payload.$ = dictionaryExpression.text
      }
      return payload
    } else {
      throw new Error("expected value to marshall")
    }
  }
  unmarshall(payload: Data.JSON, expressionSource: Data.TypeExpression | string = "*?"): Data.Value {
    switch (typeof payload) {
      case "undefined":
        // this happens when mandatory record fields are missing
        throw new Error("undefined JSON representation (missing record field?)")
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
    const expression = typeof expressionSource === "string" ? parseTypeExpression(expressionSource) : expressionSource
    const contextualType = this.#dataspace.evaluate(expression)
    if (Array.isArray(payload)) {
      // array payload results in either a list or a tuple
      if (contextualType.match(isListType)) {
        return this.#unmarshallListValue(contextualType as Data.Type<Data.List<Data.Value>>, payload)
      } else if (contextualType.match(isTupleType)) {
        return this.#unmarshallTupleValue(contextualType as Data.Type<Data.Tuple<Data.ValueSequence>>, payload)
      } else {
        throw new Error("expected list or tuple type for an array payload")
      }
    } else if ("$" in payload && "_" in payload) {
      // rich payload with $ and _
      const type = this.#dataspace.evaluate(payload.$ as string)
      if (Array.isArray(payload._)) {
        // nested array results in either a list or a tuple
        const payloadMembers = payload._
        if (type.match(isListType)) {
          return this.#unmarshallListValue(type as Data.Type<Data.List<Data.Value>>, payloadMembers)
        } else if (type.match(isTupleType)) {
          return this.#unmarshallTupleValue(type as Data.Type<Data.Tuple<Data.ValueSequence>>, payloadMembers)
        } else {
          throw new Error("expected list or tuple type for a nested array payload")
        }
      } else if (type.match(isDictionaryType)) {
        return this.#unmarshallDictionaryValue(
          type as Data.Type<Data.Dictionary<Data.Value>>,
          payload._ as { [key: string]: Data.JSON }
        )
      } else {
        throw new Error("unable to unmarshall invalid nested payload")
      }
    } else if ("$" in payload) {
      // rich payload with record fields
      const type = this.#dataspace.evaluate(payload.$ as string)
      if (type.match(isRecordType)) {
        return this.#unmarshallRecordValue(type as Data.Type<Data.Record<Data.FieldValues>>, payload)
      } else {
        throw new Error("expected record type for payload")
      }
    } else if ("_" in payload) {
      if (contextualType.match(isDictionaryType)) {
        return this.#unmarshallDictionaryValue(
          contextualType as Data.Type<Data.Dictionary<Data.Value>>,
          payload._ as { [key: string]: Data.JSON }
        )
      } else {
        throw new Error("expected dictionary type for payload")
      }
    } else if (contextualType.match(isRecordType)) {
      return this.#unmarshallRecordValue(contextualType as Data.Type<Data.Record<Data.FieldValues>>, payload)
    } else {
      throw new Error("unable to unmarshall invalid payload")
    }
  }
}
const recordFieldTypes: Data.TypePattern<Data.FieldTypesOf<Data.FieldValues>, []> = {
  record(_type, _parameters, fieldTypes) {
    return fieldTypes
  },
  orelse() {
    throw new Error("expected a record type")
  },
}
const tupleTypes: Data.TypePattern<Data.Type<Data.Value>[], []> = {
  tuple(_type, _parameters, types) {
    return types as Data.Type<Data.Value>[]
  },
  orelse() {
    throw new Error("expected a tuple type")
  },
}
const elementaryType: Data.TypePattern<Data.Type<Data.Value>, []> = {
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
const isListType: Data.TypePattern<boolean, []> = { list: fn.returnTrue, orelse: fn.returnFalse }
const isDictionaryType: Data.TypePattern<boolean, []> = { dictionary: fn.returnTrue, orelse: fn.returnFalse }
const isRecordType: Data.TypePattern<boolean, []> = { record: fn.returnTrue, orelse: fn.returnFalse }
const isTupleType: Data.TypePattern<boolean, []> = { tuple: fn.returnTrue, orelse: fn.returnFalse }
