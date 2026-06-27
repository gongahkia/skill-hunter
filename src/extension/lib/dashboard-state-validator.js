"use strict";
export const validate = validate20;
export default validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://dorso.dev/schemas/dashboard-state.schema.json","title":"Dorso Dashboard State","type":"object","additionalProperties":true,"required":["installId","hasActiveSession","session","currentChallenge","solveReceipt","enabledTargetIds","enabledSources","sessionDurationMinutes","emergencyBypassesPerWeek","bypassesThisWeek","emergencyBypassesRemaining","bypassWeekStart","currentRun","longestRun","graceDaysRemaining","isPaused","supportedTargets","supportedSources","uiMessage","messageFailureCount","leetcodeDetectionWarning"],"properties":{"installId":{"type":["string","null"]},"hasActiveSession":{"type":"boolean"},"session":{"type":"object","additionalProperties":true,"required":["isActive","timeRemaining"],"properties":{"isActive":{"type":"boolean"},"timeRemaining":{"type":"number","minimum":0},"lastSolvedTime":{"type":"string"},"expiresAt":{"type":"string"}}},"currentChallenge":{"oneOf":[{"type":"null"},{"type":"object","additionalProperties":true,"required":["source","slug","title","url","difficulty"],"properties":{"source":{"type":"string"},"source_label":{"type":"string"},"challenge_id":{"type":"string"},"slug":{"type":"string"},"title":{"type":"string"},"url":{"type":"string"},"difficulty":{"type":["string","number"]},"topic_tags":{"type":"array","items":{"type":"string"}},"guidance":{"type":"string"},"selection_mode":{"type":"string"},"supports_verification":{"type":"boolean"}}}]},"solveReceipt":{"oneOf":[{"type":"null"},{"type":"object","additionalProperties":true,"required":["problemTitle","sourceLabel","timeToSolveMs","solvedAt","currentRun"],"properties":{"problemTitle":{"type":"string"},"sourceLabel":{"type":"string"},"timeToSolveMs":{"type":"number","minimum":0},"solvedAt":{"type":"string"},"currentRun":{"type":"integer","minimum":0}}}]},"enabledTargetIds":{"type":"array","items":{"type":"string"}},"enabledSources":{"type":"array","items":{"type":"string"}},"sessionDurationMinutes":{"type":"number","minimum":1},"emergencyBypassesPerWeek":{"type":"integer","minimum":0,"maximum":7},"bypassesThisWeek":{"type":"integer","minimum":0},"emergencyBypassesRemaining":{"type":"integer","minimum":0},"bypassWeekStart":{"type":"number"},"currentRun":{"type":"integer","minimum":0},"longestRun":{"type":"integer","minimum":0},"graceDaysRemaining":{"type":"integer","minimum":0},"isPaused":{"type":"boolean"},"supportedTargets":{"type":"array","items":{"type":"object","additionalProperties":true,"required":["id","label","matches"],"properties":{"id":{"type":"string"},"label":{"type":"string"},"hostnames":{"type":"array","items":{"type":"string"}},"pathPrefixes":{"type":"array","items":{"type":"string"}},"matches":{"type":"array","items":{"type":"string"}}}}},"supportedSources":{"type":"array","items":{"type":"object","additionalProperties":true,"required":["id","label","isAvailable"],"properties":{"id":{"type":"string"},"label":{"type":"string"},"isAvailable":{"type":"boolean"}}}},"uiMessage":{"type":"string"},"messageFailureCount":{"type":"number","minimum":0},"leetcodeDetectionWarning":{"type":"string"}}};

function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="https://dorso.dev/schemas/dashboard-state.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate20.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if((((((((((((((((((((((data.installId === undefined) && (missing0 = "installId")) || ((data.hasActiveSession === undefined) && (missing0 = "hasActiveSession"))) || ((data.session === undefined) && (missing0 = "session"))) || ((data.currentChallenge === undefined) && (missing0 = "currentChallenge"))) || ((data.solveReceipt === undefined) && (missing0 = "solveReceipt"))) || ((data.enabledTargetIds === undefined) && (missing0 = "enabledTargetIds"))) || ((data.enabledSources === undefined) && (missing0 = "enabledSources"))) || ((data.sessionDurationMinutes === undefined) && (missing0 = "sessionDurationMinutes"))) || ((data.emergencyBypassesPerWeek === undefined) && (missing0 = "emergencyBypassesPerWeek"))) || ((data.bypassesThisWeek === undefined) && (missing0 = "bypassesThisWeek"))) || ((data.emergencyBypassesRemaining === undefined) && (missing0 = "emergencyBypassesRemaining"))) || ((data.bypassWeekStart === undefined) && (missing0 = "bypassWeekStart"))) || ((data.currentRun === undefined) && (missing0 = "currentRun"))) || ((data.longestRun === undefined) && (missing0 = "longestRun"))) || ((data.graceDaysRemaining === undefined) && (missing0 = "graceDaysRemaining"))) || ((data.isPaused === undefined) && (missing0 = "isPaused"))) || ((data.supportedTargets === undefined) && (missing0 = "supportedTargets"))) || ((data.supportedSources === undefined) && (missing0 = "supportedSources"))) || ((data.uiMessage === undefined) && (missing0 = "uiMessage"))) || ((data.messageFailureCount === undefined) && (missing0 = "messageFailureCount"))) || ((data.leetcodeDetectionWarning === undefined) && (missing0 = "leetcodeDetectionWarning"))){
validate20.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
if(data.installId !== undefined){
let data0 = data.installId;
const _errs2 = errors;
if((typeof data0 !== "string") && (data0 !== null)){
validate20.errors = [{instancePath:instancePath+"/installId",schemaPath:"#/properties/installId/type",keyword:"type",params:{type: schema31.properties.installId.type},message:"must be string,null"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.hasActiveSession !== undefined){
const _errs4 = errors;
if(typeof data.hasActiveSession !== "boolean"){
validate20.errors = [{instancePath:instancePath+"/hasActiveSession",schemaPath:"#/properties/hasActiveSession/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.session !== undefined){
let data2 = data.session;
const _errs6 = errors;
if(errors === _errs6){
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
let missing1;
if(((data2.isActive === undefined) && (missing1 = "isActive")) || ((data2.timeRemaining === undefined) && (missing1 = "timeRemaining"))){
validate20.errors = [{instancePath:instancePath+"/session",schemaPath:"#/properties/session/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
if(data2.isActive !== undefined){
const _errs9 = errors;
if(typeof data2.isActive !== "boolean"){
validate20.errors = [{instancePath:instancePath+"/session/isActive",schemaPath:"#/properties/session/properties/isActive/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid1 = _errs9 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data2.timeRemaining !== undefined){
let data4 = data2.timeRemaining;
const _errs11 = errors;
if(errors === _errs11){
if(typeof data4 == "number"){
if(data4 < 0 || isNaN(data4)){
validate20.errors = [{instancePath:instancePath+"/session/timeRemaining",schemaPath:"#/properties/session/properties/timeRemaining/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/session/timeRemaining",schemaPath:"#/properties/session/properties/timeRemaining/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid1 = _errs11 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data2.lastSolvedTime !== undefined){
const _errs13 = errors;
if(typeof data2.lastSolvedTime !== "string"){
validate20.errors = [{instancePath:instancePath+"/session/lastSolvedTime",schemaPath:"#/properties/session/properties/lastSolvedTime/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs13 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data2.expiresAt !== undefined){
const _errs15 = errors;
if(typeof data2.expiresAt !== "string"){
validate20.errors = [{instancePath:instancePath+"/session/expiresAt",schemaPath:"#/properties/session/properties/expiresAt/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs15 === errors;
}
else {
var valid1 = true;
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/session",schemaPath:"#/properties/session/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs6 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.currentChallenge !== undefined){
let data7 = data.currentChallenge;
const _errs17 = errors;
const _errs18 = errors;
let valid2 = false;
let passing0 = null;
const _errs19 = errors;
if(data7 !== null){
const err0 = {instancePath:instancePath+"/currentChallenge",schemaPath:"#/properties/currentChallenge/oneOf/0/type",keyword:"type",params:{type: "null"},message:"must be null"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
var _valid0 = _errs19 === errors;
if(_valid0){
valid2 = true;
passing0 = 0;
}
const _errs21 = errors;
if(errors === _errs21){
if(data7 && typeof data7 == "object" && !Array.isArray(data7)){
let missing2;
if((((((data7.source === undefined) && (missing2 = "source")) || ((data7.slug === undefined) && (missing2 = "slug"))) || ((data7.title === undefined) && (missing2 = "title"))) || ((data7.url === undefined) && (missing2 = "url"))) || ((data7.difficulty === undefined) && (missing2 = "difficulty"))){
const err1 = {instancePath:instancePath+"/currentChallenge",schemaPath:"#/properties/currentChallenge/oneOf/1/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
else {
if(data7.source !== undefined){
const _errs24 = errors;
if(typeof data7.source !== "string"){
const err2 = {instancePath:instancePath+"/currentChallenge/source",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/source/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
var valid3 = _errs24 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.source_label !== undefined){
const _errs26 = errors;
if(typeof data7.source_label !== "string"){
const err3 = {instancePath:instancePath+"/currentChallenge/source_label",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/source_label/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
var valid3 = _errs26 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.challenge_id !== undefined){
const _errs28 = errors;
if(typeof data7.challenge_id !== "string"){
const err4 = {instancePath:instancePath+"/currentChallenge/challenge_id",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/challenge_id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
var valid3 = _errs28 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.slug !== undefined){
const _errs30 = errors;
if(typeof data7.slug !== "string"){
const err5 = {instancePath:instancePath+"/currentChallenge/slug",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/slug/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
var valid3 = _errs30 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.title !== undefined){
const _errs32 = errors;
if(typeof data7.title !== "string"){
const err6 = {instancePath:instancePath+"/currentChallenge/title",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
var valid3 = _errs32 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.url !== undefined){
const _errs34 = errors;
if(typeof data7.url !== "string"){
const err7 = {instancePath:instancePath+"/currentChallenge/url",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/url/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
var valid3 = _errs34 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.difficulty !== undefined){
let data14 = data7.difficulty;
const _errs36 = errors;
if((typeof data14 !== "string") && (!(typeof data14 == "number"))){
const err8 = {instancePath:instancePath+"/currentChallenge/difficulty",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/difficulty/type",keyword:"type",params:{type: schema31.properties.currentChallenge.oneOf[1].properties.difficulty.type},message:"must be string,number"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
var valid3 = _errs36 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.topic_tags !== undefined){
let data15 = data7.topic_tags;
const _errs38 = errors;
if(errors === _errs38){
if(Array.isArray(data15)){
var valid4 = true;
const len0 = data15.length;
for(let i0=0; i0<len0; i0++){
const _errs40 = errors;
if(typeof data15[i0] !== "string"){
const err9 = {instancePath:instancePath+"/currentChallenge/topic_tags/" + i0,schemaPath:"#/properties/currentChallenge/oneOf/1/properties/topic_tags/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
var valid4 = _errs40 === errors;
if(!valid4){
break;
}
}
}
else {
const err10 = {instancePath:instancePath+"/currentChallenge/topic_tags",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/topic_tags/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
var valid3 = _errs38 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.guidance !== undefined){
const _errs42 = errors;
if(typeof data7.guidance !== "string"){
const err11 = {instancePath:instancePath+"/currentChallenge/guidance",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/guidance/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
var valid3 = _errs42 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.selection_mode !== undefined){
const _errs44 = errors;
if(typeof data7.selection_mode !== "string"){
const err12 = {instancePath:instancePath+"/currentChallenge/selection_mode",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/selection_mode/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
var valid3 = _errs44 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data7.supports_verification !== undefined){
const _errs46 = errors;
if(typeof data7.supports_verification !== "boolean"){
const err13 = {instancePath:instancePath+"/currentChallenge/supports_verification",schemaPath:"#/properties/currentChallenge/oneOf/1/properties/supports_verification/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
var valid3 = _errs46 === errors;
}
else {
var valid3 = true;
}
}
}
}
}
}
}
}
}
}
}
}
}
else {
const err14 = {instancePath:instancePath+"/currentChallenge",schemaPath:"#/properties/currentChallenge/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
}
var _valid0 = _errs21 === errors;
if(_valid0 && valid2){
valid2 = false;
passing0 = [passing0, 1];
}
else {
if(_valid0){
valid2 = true;
passing0 = 1;
}
}
if(!valid2){
const err15 = {instancePath:instancePath+"/currentChallenge",schemaPath:"#/properties/currentChallenge/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
validate20.errors = vErrors;
return false;
}
else {
errors = _errs18;
if(vErrors !== null){
if(_errs18){
vErrors.length = _errs18;
}
else {
vErrors = null;
}
}
}
var valid0 = _errs17 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.solveReceipt !== undefined){
let data20 = data.solveReceipt;
const _errs48 = errors;
const _errs49 = errors;
let valid5 = false;
let passing1 = null;
const _errs50 = errors;
if(data20 !== null){
const err16 = {instancePath:instancePath+"/solveReceipt",schemaPath:"#/properties/solveReceipt/oneOf/0/type",keyword:"type",params:{type: "null"},message:"must be null"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
var _valid1 = _errs50 === errors;
if(_valid1){
valid5 = true;
passing1 = 0;
}
const _errs52 = errors;
if(errors === _errs52){
if(data20 && typeof data20 == "object" && !Array.isArray(data20)){
let missing3;
if((((((data20.problemTitle === undefined) && (missing3 = "problemTitle")) || ((data20.sourceLabel === undefined) && (missing3 = "sourceLabel"))) || ((data20.timeToSolveMs === undefined) && (missing3 = "timeToSolveMs"))) || ((data20.solvedAt === undefined) && (missing3 = "solvedAt"))) || ((data20.currentRun === undefined) && (missing3 = "currentRun"))){
const err17 = {instancePath:instancePath+"/solveReceipt",schemaPath:"#/properties/solveReceipt/oneOf/1/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
else {
if(data20.problemTitle !== undefined){
const _errs55 = errors;
if(typeof data20.problemTitle !== "string"){
const err18 = {instancePath:instancePath+"/solveReceipt/problemTitle",schemaPath:"#/properties/solveReceipt/oneOf/1/properties/problemTitle/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
var valid6 = _errs55 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data20.sourceLabel !== undefined){
const _errs57 = errors;
if(typeof data20.sourceLabel !== "string"){
const err19 = {instancePath:instancePath+"/solveReceipt/sourceLabel",schemaPath:"#/properties/solveReceipt/oneOf/1/properties/sourceLabel/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
var valid6 = _errs57 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data20.timeToSolveMs !== undefined){
let data23 = data20.timeToSolveMs;
const _errs59 = errors;
if(errors === _errs59){
if(typeof data23 == "number"){
if(data23 < 0 || isNaN(data23)){
const err20 = {instancePath:instancePath+"/solveReceipt/timeToSolveMs",schemaPath:"#/properties/solveReceipt/oneOf/1/properties/timeToSolveMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
}
else {
const err21 = {instancePath:instancePath+"/solveReceipt/timeToSolveMs",schemaPath:"#/properties/solveReceipt/oneOf/1/properties/timeToSolveMs/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
var valid6 = _errs59 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data20.solvedAt !== undefined){
const _errs61 = errors;
if(typeof data20.solvedAt !== "string"){
const err22 = {instancePath:instancePath+"/solveReceipt/solvedAt",schemaPath:"#/properties/solveReceipt/oneOf/1/properties/solvedAt/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
var valid6 = _errs61 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data20.currentRun !== undefined){
let data25 = data20.currentRun;
const _errs63 = errors;
if(!((typeof data25 == "number") && (!(data25 % 1) && !isNaN(data25)))){
const err23 = {instancePath:instancePath+"/solveReceipt/currentRun",schemaPath:"#/properties/solveReceipt/oneOf/1/properties/currentRun/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
if(errors === _errs63){
if(typeof data25 == "number"){
if(data25 < 0 || isNaN(data25)){
const err24 = {instancePath:instancePath+"/solveReceipt/currentRun",schemaPath:"#/properties/solveReceipt/oneOf/1/properties/currentRun/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
}
var valid6 = _errs63 === errors;
}
else {
var valid6 = true;
}
}
}
}
}
}
}
else {
const err25 = {instancePath:instancePath+"/solveReceipt",schemaPath:"#/properties/solveReceipt/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
}
var _valid1 = _errs52 === errors;
if(_valid1 && valid5){
valid5 = false;
passing1 = [passing1, 1];
}
else {
if(_valid1){
valid5 = true;
passing1 = 1;
}
}
if(!valid5){
const err26 = {instancePath:instancePath+"/solveReceipt",schemaPath:"#/properties/solveReceipt/oneOf",keyword:"oneOf",params:{passingSchemas: passing1},message:"must match exactly one schema in oneOf"};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
validate20.errors = vErrors;
return false;
}
else {
errors = _errs49;
if(vErrors !== null){
if(_errs49){
vErrors.length = _errs49;
}
else {
vErrors = null;
}
}
}
var valid0 = _errs48 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.enabledTargetIds !== undefined){
let data26 = data.enabledTargetIds;
const _errs65 = errors;
if(errors === _errs65){
if(Array.isArray(data26)){
var valid7 = true;
const len1 = data26.length;
for(let i1=0; i1<len1; i1++){
const _errs67 = errors;
if(typeof data26[i1] !== "string"){
validate20.errors = [{instancePath:instancePath+"/enabledTargetIds/" + i1,schemaPath:"#/properties/enabledTargetIds/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid7 = _errs67 === errors;
if(!valid7){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/enabledTargetIds",schemaPath:"#/properties/enabledTargetIds/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs65 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.enabledSources !== undefined){
let data28 = data.enabledSources;
const _errs69 = errors;
if(errors === _errs69){
if(Array.isArray(data28)){
var valid8 = true;
const len2 = data28.length;
for(let i2=0; i2<len2; i2++){
const _errs71 = errors;
if(typeof data28[i2] !== "string"){
validate20.errors = [{instancePath:instancePath+"/enabledSources/" + i2,schemaPath:"#/properties/enabledSources/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid8 = _errs71 === errors;
if(!valid8){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/enabledSources",schemaPath:"#/properties/enabledSources/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs69 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.sessionDurationMinutes !== undefined){
let data30 = data.sessionDurationMinutes;
const _errs73 = errors;
if(errors === _errs73){
if(typeof data30 == "number"){
if(data30 < 1 || isNaN(data30)){
validate20.errors = [{instancePath:instancePath+"/sessionDurationMinutes",schemaPath:"#/properties/sessionDurationMinutes/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/sessionDurationMinutes",schemaPath:"#/properties/sessionDurationMinutes/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid0 = _errs73 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.emergencyBypassesPerWeek !== undefined){
let data31 = data.emergencyBypassesPerWeek;
const _errs75 = errors;
if(!((typeof data31 == "number") && (!(data31 % 1) && !isNaN(data31)))){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesPerWeek",schemaPath:"#/properties/emergencyBypassesPerWeek/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs75){
if(typeof data31 == "number"){
if(data31 > 7 || isNaN(data31)){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesPerWeek",schemaPath:"#/properties/emergencyBypassesPerWeek/maximum",keyword:"maximum",params:{comparison: "<=", limit: 7},message:"must be <= 7"}];
return false;
}
else {
if(data31 < 0 || isNaN(data31)){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesPerWeek",schemaPath:"#/properties/emergencyBypassesPerWeek/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
}
var valid0 = _errs75 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.bypassesThisWeek !== undefined){
let data32 = data.bypassesThisWeek;
const _errs77 = errors;
if(!((typeof data32 == "number") && (!(data32 % 1) && !isNaN(data32)))){
validate20.errors = [{instancePath:instancePath+"/bypassesThisWeek",schemaPath:"#/properties/bypassesThisWeek/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs77){
if(typeof data32 == "number"){
if(data32 < 0 || isNaN(data32)){
validate20.errors = [{instancePath:instancePath+"/bypassesThisWeek",schemaPath:"#/properties/bypassesThisWeek/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs77 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.emergencyBypassesRemaining !== undefined){
let data33 = data.emergencyBypassesRemaining;
const _errs79 = errors;
if(!((typeof data33 == "number") && (!(data33 % 1) && !isNaN(data33)))){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesRemaining",schemaPath:"#/properties/emergencyBypassesRemaining/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs79){
if(typeof data33 == "number"){
if(data33 < 0 || isNaN(data33)){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesRemaining",schemaPath:"#/properties/emergencyBypassesRemaining/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs79 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.bypassWeekStart !== undefined){
const _errs81 = errors;
if(!(typeof data.bypassWeekStart == "number")){
validate20.errors = [{instancePath:instancePath+"/bypassWeekStart",schemaPath:"#/properties/bypassWeekStart/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
var valid0 = _errs81 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.currentRun !== undefined){
let data35 = data.currentRun;
const _errs83 = errors;
if(!((typeof data35 == "number") && (!(data35 % 1) && !isNaN(data35)))){
validate20.errors = [{instancePath:instancePath+"/currentRun",schemaPath:"#/properties/currentRun/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs83){
if(typeof data35 == "number"){
if(data35 < 0 || isNaN(data35)){
validate20.errors = [{instancePath:instancePath+"/currentRun",schemaPath:"#/properties/currentRun/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs83 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.longestRun !== undefined){
let data36 = data.longestRun;
const _errs85 = errors;
if(!((typeof data36 == "number") && (!(data36 % 1) && !isNaN(data36)))){
validate20.errors = [{instancePath:instancePath+"/longestRun",schemaPath:"#/properties/longestRun/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs85){
if(typeof data36 == "number"){
if(data36 < 0 || isNaN(data36)){
validate20.errors = [{instancePath:instancePath+"/longestRun",schemaPath:"#/properties/longestRun/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs85 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.graceDaysRemaining !== undefined){
let data37 = data.graceDaysRemaining;
const _errs87 = errors;
if(!((typeof data37 == "number") && (!(data37 % 1) && !isNaN(data37)))){
validate20.errors = [{instancePath:instancePath+"/graceDaysRemaining",schemaPath:"#/properties/graceDaysRemaining/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs87){
if(typeof data37 == "number"){
if(data37 < 0 || isNaN(data37)){
validate20.errors = [{instancePath:instancePath+"/graceDaysRemaining",schemaPath:"#/properties/graceDaysRemaining/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs87 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.isPaused !== undefined){
const _errs89 = errors;
if(typeof data.isPaused !== "boolean"){
validate20.errors = [{instancePath:instancePath+"/isPaused",schemaPath:"#/properties/isPaused/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid0 = _errs89 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.supportedTargets !== undefined){
let data39 = data.supportedTargets;
const _errs91 = errors;
if(errors === _errs91){
if(Array.isArray(data39)){
var valid9 = true;
const len3 = data39.length;
for(let i3=0; i3<len3; i3++){
let data40 = data39[i3];
const _errs93 = errors;
if(errors === _errs93){
if(data40 && typeof data40 == "object" && !Array.isArray(data40)){
let missing4;
if((((data40.id === undefined) && (missing4 = "id")) || ((data40.label === undefined) && (missing4 = "label"))) || ((data40.matches === undefined) && (missing4 = "matches"))){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3,schemaPath:"#/properties/supportedTargets/items/required",keyword:"required",params:{missingProperty: missing4},message:"must have required property '"+missing4+"'"}];
return false;
}
else {
if(data40.id !== undefined){
const _errs96 = errors;
if(typeof data40.id !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/id",schemaPath:"#/properties/supportedTargets/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid10 = _errs96 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data40.label !== undefined){
const _errs98 = errors;
if(typeof data40.label !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/label",schemaPath:"#/properties/supportedTargets/items/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid10 = _errs98 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data40.hostnames !== undefined){
let data43 = data40.hostnames;
const _errs100 = errors;
if(errors === _errs100){
if(Array.isArray(data43)){
var valid11 = true;
const len4 = data43.length;
for(let i4=0; i4<len4; i4++){
const _errs102 = errors;
if(typeof data43[i4] !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/hostnames/" + i4,schemaPath:"#/properties/supportedTargets/items/properties/hostnames/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid11 = _errs102 === errors;
if(!valid11){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/hostnames",schemaPath:"#/properties/supportedTargets/items/properties/hostnames/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid10 = _errs100 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data40.pathPrefixes !== undefined){
let data45 = data40.pathPrefixes;
const _errs104 = errors;
if(errors === _errs104){
if(Array.isArray(data45)){
var valid12 = true;
const len5 = data45.length;
for(let i5=0; i5<len5; i5++){
const _errs106 = errors;
if(typeof data45[i5] !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/pathPrefixes/" + i5,schemaPath:"#/properties/supportedTargets/items/properties/pathPrefixes/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid12 = _errs106 === errors;
if(!valid12){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/pathPrefixes",schemaPath:"#/properties/supportedTargets/items/properties/pathPrefixes/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid10 = _errs104 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data40.matches !== undefined){
let data47 = data40.matches;
const _errs108 = errors;
if(errors === _errs108){
if(Array.isArray(data47)){
var valid13 = true;
const len6 = data47.length;
for(let i6=0; i6<len6; i6++){
const _errs110 = errors;
if(typeof data47[i6] !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/matches/" + i6,schemaPath:"#/properties/supportedTargets/items/properties/matches/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid13 = _errs110 === errors;
if(!valid13){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3+"/matches",schemaPath:"#/properties/supportedTargets/items/properties/matches/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid10 = _errs108 === errors;
}
else {
var valid10 = true;
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i3,schemaPath:"#/properties/supportedTargets/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid9 = _errs93 === errors;
if(!valid9){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets",schemaPath:"#/properties/supportedTargets/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs91 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.supportedSources !== undefined){
let data49 = data.supportedSources;
const _errs112 = errors;
if(errors === _errs112){
if(Array.isArray(data49)){
var valid14 = true;
const len7 = data49.length;
for(let i7=0; i7<len7; i7++){
let data50 = data49[i7];
const _errs114 = errors;
if(errors === _errs114){
if(data50 && typeof data50 == "object" && !Array.isArray(data50)){
let missing5;
if((((data50.id === undefined) && (missing5 = "id")) || ((data50.label === undefined) && (missing5 = "label"))) || ((data50.isAvailable === undefined) && (missing5 = "isAvailable"))){
validate20.errors = [{instancePath:instancePath+"/supportedSources/" + i7,schemaPath:"#/properties/supportedSources/items/required",keyword:"required",params:{missingProperty: missing5},message:"must have required property '"+missing5+"'"}];
return false;
}
else {
if(data50.id !== undefined){
const _errs117 = errors;
if(typeof data50.id !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedSources/" + i7+"/id",schemaPath:"#/properties/supportedSources/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid15 = _errs117 === errors;
}
else {
var valid15 = true;
}
if(valid15){
if(data50.label !== undefined){
const _errs119 = errors;
if(typeof data50.label !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedSources/" + i7+"/label",schemaPath:"#/properties/supportedSources/items/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid15 = _errs119 === errors;
}
else {
var valid15 = true;
}
if(valid15){
if(data50.isAvailable !== undefined){
const _errs121 = errors;
if(typeof data50.isAvailable !== "boolean"){
validate20.errors = [{instancePath:instancePath+"/supportedSources/" + i7+"/isAvailable",schemaPath:"#/properties/supportedSources/items/properties/isAvailable/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid15 = _errs121 === errors;
}
else {
var valid15 = true;
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedSources/" + i7,schemaPath:"#/properties/supportedSources/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid14 = _errs114 === errors;
if(!valid14){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedSources",schemaPath:"#/properties/supportedSources/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs112 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.uiMessage !== undefined){
const _errs123 = errors;
if(typeof data.uiMessage !== "string"){
validate20.errors = [{instancePath:instancePath+"/uiMessage",schemaPath:"#/properties/uiMessage/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs123 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.messageFailureCount !== undefined){
let data55 = data.messageFailureCount;
const _errs125 = errors;
if(errors === _errs125){
if(typeof data55 == "number"){
if(data55 < 0 || isNaN(data55)){
validate20.errors = [{instancePath:instancePath+"/messageFailureCount",schemaPath:"#/properties/messageFailureCount/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/messageFailureCount",schemaPath:"#/properties/messageFailureCount/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid0 = _errs125 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.leetcodeDetectionWarning !== undefined){
const _errs127 = errors;
if(typeof data.leetcodeDetectionWarning !== "string"){
validate20.errors = [{instancePath:instancePath+"/leetcodeDetectionWarning",schemaPath:"#/properties/leetcodeDetectionWarning/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs127 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};
