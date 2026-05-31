export const include = ["std.data"]
export const definitions = {
  "Net.Options": "{i:int32}",
  "Net.Address": "{global:string,local:string,network:string?}",
  "Net.Bla": "Data.Maybe(int32)",
  "Net.Foo": '{a:int32,b:42,c:string,d:":-)"}',
  "Net.Bar": "{b:string}",
  "Net.Baz": "{wtf:int32,bla:{bla:3,/Net.Baz}}",
}
