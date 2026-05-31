// not sure yet where this is going...
export const definitions = {
  // 1 = first outer type, 2 = second outer type, 3 = third outer type, etc...
  "Meta.Value": 'int32|"*"|Meta.Simple|Meta.List|Meta.Dictionary|Meta.Record|Meta.Optional|Meta.Union',
  "Meta.Simple": '"boolean"|"int32"|"number"|"string"|{lit:boolean|int32|string}',
  // nested values can refer to outer types
  "Meta.List": "{seq:Meta.Value}",
  "Meta.Dictionary": "{key:Meta.Value}",
  "Meta.Tuple": "{tup:[Meta.Value]}",
  "Meta.Record": "<Meta.Value>",
  "Meta.Optional": "{man:Meta.Value}",
  "Meta.Union": "[Meta.Value]",
}
