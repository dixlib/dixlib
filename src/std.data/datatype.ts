export const include = ["std.data.meta"]
export const definitions = {
  // int32 is a subtype of number, but it's still a basic number
  "Data.Basic": "boolean|number|string",
  // defined values
  "Data.Wildcard": "*",
  // any value, including undefined
  "Data.Any": "*?",
  // optional values
  "Data.Maybe": "a=* a?",
  // sequential and string-keyed collections
  "Data.List": "a=*? [a]",
  "Data.Dictionary": "a=*? <a>",
  // multidimensional tuples
  "Data.Pair": "a=*? b=*? (a,b)",
  "Data.Triple": "a=*? b=*? c=*? (a,b,c)",
  "Data.Quadruple": "a=*? b=*? c=*? d=*? (a,b,c,d)",
  "Data.Quintuple": "a=*? b=*? c=*? d=*? e=*? (a,b,c,d,e)",
  "Data.Sextuple": "a=*? b=*? c=*? d=*? e=*? f=*? (a,b,c,d,e,f)",
  "Data.Septuple": "a=*? b=*? c=*? d=*? e=*? f=*? g=*? (a,b,c,d,e,f,g)",
  "Data.Octuple": "a=*? b=*? c=*? d=*? e=*? f=*? g=*? h=*? (a,b,c,d,e,f,g,h)",
  "Data.Nonuple": "a=*? b=*? c=*? d=*? e=*? f=*? g=*? h=*? i=*? (a,b,c,d,e,f,g,h,i)",
  // ten-dimensional tuple is pushing the limit of human working memory (Miller's 7 ± 2 rule)
  "Data.Decuple": "a=*? b=*? c=*? d=*? e=*? f=*? g=*? h=*? i=*? j=*? (a,b,c,d,e,f,g,h,i,j)",
  // spread record fields
  "Data.Spread": "a={} b={} c={} d={} e={} f={} g={} h={} i={} j={} {/a,/b,/c,/d,/e,/f,/g,/h,/i,/j}",
}
