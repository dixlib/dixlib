export const definitions = {
  "Data.Basic": "boolean|number|string",
  "Data.Wildcard": "*",
  "Data.Any": "*?",
  "Data.Maybe": "a=* a?",
  "Data.List": "a=*? [a]",
  "Data.Dictionary": "a=*? <a>",
  "Data.Pair": "a=*? b=*? (a,b)",
  "Data.BinTree": "a=*? Data.Maybe({left:Data.BinTree(a),right:Data.BinTree(a),value:a})",
  "Data.Bla": "a=*? b=*? a|b"
}
