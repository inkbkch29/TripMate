import {describe,it,expect} from "vitest";
import {storedTripKey,attachmentError} from "./ui-workflows";
describe("trip cache isolation",()=>{
 it("separates demo, accounts and trips",()=>{
 const keys=[storedTripKey("members"),storedTripKey("members","a","one"),storedTripKey("members","a","two"),storedTripKey("members","b","one"),storedTripKey("expenses","a","one")];
 expect(new Set(keys).size).toBe(keys.length);
 });
});
describe("payment attachments",()=>{
 it("accepts supported images and PDF at the size limit",()=>{for(const type of ["image/jpeg","image/png","image/webp","application/pdf"])expect(attachmentError({type,size:15*1024*1024})).toBe("");});
 it("rejects missing, empty, unsupported and oversized files",()=>{for(const file of [null,{type:"text/plain",size:1},{type:"image/png",size:0},{type:"image/png",size:15*1024*1024+1}])expect(attachmentError(file)).not.toBe("");});
});
