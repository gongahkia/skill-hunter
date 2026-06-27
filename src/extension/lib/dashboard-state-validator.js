"use strict";
export const validate = validate20;
export default validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://dorso.dev/schemas/dashboard-state.schema.json","title":"Dorso Dashboard State","type":"object","additionalProperties":true,"required":["installId","hasActiveSession","session","currentChallenge","enabledTargetIds","sessionDurationMinutes","emergencyBypassesPerWeek","bypassesThisWeek","emergencyBypassesRemaining","bypassWeekStart","currentRun","longestRun","graceDaysRemaining","isPaused","supportedTargets","uiMessage","messageFailureCount","leetcodeDetectionWarning"],"properties":{"installId":{"type":["string","null"]},"hasActiveSession":{"type":"boolean"},"session":{"type":"object","additionalProperties":true,"required":["isActive","timeRemaining"],"properties":{"isActive":{"type":"boolean"},"timeRemaining":{"type":"number","minimum":0},"lastSolvedTime":{"type":"string"},"expiresAt":{"type":"string"}}},"currentChallenge":{"oneOf":[{"type":"null"},{"type":"object","additionalProperties":true,"required":["source","slug","title","url","difficulty"],"properties":{"source":{"type":"string"},"source_label":{"type":"string"},"challenge_id":{"type":"string"},"slug":{"type":"string"},"title":{"type":"string"},"url":{"type":"string"},"difficulty":{"type":["string","number"]},"topic_tags":{"type":"array","items":{"type":"string"}},"guidance":{"type":"string"},"selection_mode":{"type":"string"},"supports_verification":{"type":"boolean"}}}]},"enabledTargetIds":{"type":"array","items":{"type":"string"}},"sessionDurationMinutes":{"type":"number","minimum":1},"emergencyBypassesPerWeek":{"type":"integer","minimum":0,"maximum":7},"bypassesThisWeek":{"type":"integer","minimum":0},"emergencyBypassesRemaining":{"type":"integer","minimum":0},"bypassWeekStart":{"type":"number"},"currentRun":{"type":"integer","minimum":0},"longestRun":{"type":"integer","minimum":0},"graceDaysRemaining":{"type":"integer","minimum":0},"isPaused":{"type":"boolean"},"supportedTargets":{"type":"array","items":{"type":"object","additionalProperties":true,"required":["id","label","matches"],"properties":{"id":{"type":"string"},"label":{"type":"string"},"hostnames":{"type":"array","items":{"type":"string"}},"pathPrefixes":{"type":"array","items":{"type":"string"}},"matches":{"type":"array","items":{"type":"string"}}}}},"uiMessage":{"type":"string"},"messageFailureCount":{"type":"number","minimum":0},"leetcodeDetectionWarning":{"type":"string"}}};

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
if(((((((((((((((((((data.installId === undefined) && (missing0 = "installId")) || ((data.hasActiveSession === undefined) && (missing0 = "hasActiveSession"))) || ((data.session === undefined) && (missing0 = "session"))) || ((data.currentChallenge === undefined) && (missing0 = "currentChallenge"))) || ((data.enabledTargetIds === undefined) && (missing0 = "enabledTargetIds"))) || ((data.sessionDurationMinutes === undefined) && (missing0 = "sessionDurationMinutes"))) || ((data.emergencyBypassesPerWeek === undefined) && (missing0 = "emergencyBypassesPerWeek"))) || ((data.bypassesThisWeek === undefined) && (missing0 = "bypassesThisWeek"))) || ((data.emergencyBypassesRemaining === undefined) && (missing0 = "emergencyBypassesRemaining"))) || ((data.bypassWeekStart === undefined) && (missing0 = "bypassWeekStart"))) || ((data.currentRun === undefined) && (missing0 = "currentRun"))) || ((data.longestRun === undefined) && (missing0 = "longestRun"))) || ((data.graceDaysRemaining === undefined) && (missing0 = "graceDaysRemaining"))) || ((data.isPaused === undefined) && (missing0 = "isPaused"))) || ((data.supportedTargets === undefined) && (missing0 = "supportedTargets"))) || ((data.uiMessage === undefined) && (missing0 = "uiMessage"))) || ((data.messageFailureCount === undefined) && (missing0 = "messageFailureCount"))) || ((data.leetcodeDetectionWarning === undefined) && (missing0 = "leetcodeDetectionWarning"))){
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
if(data.enabledTargetIds !== undefined){
let data20 = data.enabledTargetIds;
const _errs48 = errors;
if(errors === _errs48){
if(Array.isArray(data20)){
var valid5 = true;
const len1 = data20.length;
for(let i1=0; i1<len1; i1++){
const _errs50 = errors;
if(typeof data20[i1] !== "string"){
validate20.errors = [{instancePath:instancePath+"/enabledTargetIds/" + i1,schemaPath:"#/properties/enabledTargetIds/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid5 = _errs50 === errors;
if(!valid5){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/enabledTargetIds",schemaPath:"#/properties/enabledTargetIds/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs48 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.sessionDurationMinutes !== undefined){
let data22 = data.sessionDurationMinutes;
const _errs52 = errors;
if(errors === _errs52){
if(typeof data22 == "number"){
if(data22 < 1 || isNaN(data22)){
validate20.errors = [{instancePath:instancePath+"/sessionDurationMinutes",schemaPath:"#/properties/sessionDurationMinutes/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/sessionDurationMinutes",schemaPath:"#/properties/sessionDurationMinutes/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid0 = _errs52 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.emergencyBypassesPerWeek !== undefined){
let data23 = data.emergencyBypassesPerWeek;
const _errs54 = errors;
if(!((typeof data23 == "number") && (!(data23 % 1) && !isNaN(data23)))){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesPerWeek",schemaPath:"#/properties/emergencyBypassesPerWeek/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs54){
if(typeof data23 == "number"){
if(data23 > 7 || isNaN(data23)){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesPerWeek",schemaPath:"#/properties/emergencyBypassesPerWeek/maximum",keyword:"maximum",params:{comparison: "<=", limit: 7},message:"must be <= 7"}];
return false;
}
else {
if(data23 < 0 || isNaN(data23)){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesPerWeek",schemaPath:"#/properties/emergencyBypassesPerWeek/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
}
var valid0 = _errs54 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.bypassesThisWeek !== undefined){
let data24 = data.bypassesThisWeek;
const _errs56 = errors;
if(!((typeof data24 == "number") && (!(data24 % 1) && !isNaN(data24)))){
validate20.errors = [{instancePath:instancePath+"/bypassesThisWeek",schemaPath:"#/properties/bypassesThisWeek/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs56){
if(typeof data24 == "number"){
if(data24 < 0 || isNaN(data24)){
validate20.errors = [{instancePath:instancePath+"/bypassesThisWeek",schemaPath:"#/properties/bypassesThisWeek/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs56 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.emergencyBypassesRemaining !== undefined){
let data25 = data.emergencyBypassesRemaining;
const _errs58 = errors;
if(!((typeof data25 == "number") && (!(data25 % 1) && !isNaN(data25)))){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesRemaining",schemaPath:"#/properties/emergencyBypassesRemaining/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs58){
if(typeof data25 == "number"){
if(data25 < 0 || isNaN(data25)){
validate20.errors = [{instancePath:instancePath+"/emergencyBypassesRemaining",schemaPath:"#/properties/emergencyBypassesRemaining/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs58 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.bypassWeekStart !== undefined){
const _errs60 = errors;
if(!(typeof data.bypassWeekStart == "number")){
validate20.errors = [{instancePath:instancePath+"/bypassWeekStart",schemaPath:"#/properties/bypassWeekStart/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
var valid0 = _errs60 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.currentRun !== undefined){
let data27 = data.currentRun;
const _errs62 = errors;
if(!((typeof data27 == "number") && (!(data27 % 1) && !isNaN(data27)))){
validate20.errors = [{instancePath:instancePath+"/currentRun",schemaPath:"#/properties/currentRun/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs62){
if(typeof data27 == "number"){
if(data27 < 0 || isNaN(data27)){
validate20.errors = [{instancePath:instancePath+"/currentRun",schemaPath:"#/properties/currentRun/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs62 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.longestRun !== undefined){
let data28 = data.longestRun;
const _errs64 = errors;
if(!((typeof data28 == "number") && (!(data28 % 1) && !isNaN(data28)))){
validate20.errors = [{instancePath:instancePath+"/longestRun",schemaPath:"#/properties/longestRun/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs64){
if(typeof data28 == "number"){
if(data28 < 0 || isNaN(data28)){
validate20.errors = [{instancePath:instancePath+"/longestRun",schemaPath:"#/properties/longestRun/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs64 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.graceDaysRemaining !== undefined){
let data29 = data.graceDaysRemaining;
const _errs66 = errors;
if(!((typeof data29 == "number") && (!(data29 % 1) && !isNaN(data29)))){
validate20.errors = [{instancePath:instancePath+"/graceDaysRemaining",schemaPath:"#/properties/graceDaysRemaining/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs66){
if(typeof data29 == "number"){
if(data29 < 0 || isNaN(data29)){
validate20.errors = [{instancePath:instancePath+"/graceDaysRemaining",schemaPath:"#/properties/graceDaysRemaining/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs66 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.isPaused !== undefined){
const _errs68 = errors;
if(typeof data.isPaused !== "boolean"){
validate20.errors = [{instancePath:instancePath+"/isPaused",schemaPath:"#/properties/isPaused/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid0 = _errs68 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.supportedTargets !== undefined){
let data31 = data.supportedTargets;
const _errs70 = errors;
if(errors === _errs70){
if(Array.isArray(data31)){
var valid6 = true;
const len2 = data31.length;
for(let i2=0; i2<len2; i2++){
let data32 = data31[i2];
const _errs72 = errors;
if(errors === _errs72){
if(data32 && typeof data32 == "object" && !Array.isArray(data32)){
let missing3;
if((((data32.id === undefined) && (missing3 = "id")) || ((data32.label === undefined) && (missing3 = "label"))) || ((data32.matches === undefined) && (missing3 = "matches"))){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2,schemaPath:"#/properties/supportedTargets/items/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"}];
return false;
}
else {
if(data32.id !== undefined){
const _errs75 = errors;
if(typeof data32.id !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/id",schemaPath:"#/properties/supportedTargets/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid7 = _errs75 === errors;
}
else {
var valid7 = true;
}
if(valid7){
if(data32.label !== undefined){
const _errs77 = errors;
if(typeof data32.label !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/label",schemaPath:"#/properties/supportedTargets/items/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid7 = _errs77 === errors;
}
else {
var valid7 = true;
}
if(valid7){
if(data32.hostnames !== undefined){
let data35 = data32.hostnames;
const _errs79 = errors;
if(errors === _errs79){
if(Array.isArray(data35)){
var valid8 = true;
const len3 = data35.length;
for(let i3=0; i3<len3; i3++){
const _errs81 = errors;
if(typeof data35[i3] !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/hostnames/" + i3,schemaPath:"#/properties/supportedTargets/items/properties/hostnames/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid8 = _errs81 === errors;
if(!valid8){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/hostnames",schemaPath:"#/properties/supportedTargets/items/properties/hostnames/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid7 = _errs79 === errors;
}
else {
var valid7 = true;
}
if(valid7){
if(data32.pathPrefixes !== undefined){
let data37 = data32.pathPrefixes;
const _errs83 = errors;
if(errors === _errs83){
if(Array.isArray(data37)){
var valid9 = true;
const len4 = data37.length;
for(let i4=0; i4<len4; i4++){
const _errs85 = errors;
if(typeof data37[i4] !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/pathPrefixes/" + i4,schemaPath:"#/properties/supportedTargets/items/properties/pathPrefixes/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid9 = _errs85 === errors;
if(!valid9){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/pathPrefixes",schemaPath:"#/properties/supportedTargets/items/properties/pathPrefixes/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid7 = _errs83 === errors;
}
else {
var valid7 = true;
}
if(valid7){
if(data32.matches !== undefined){
let data39 = data32.matches;
const _errs87 = errors;
if(errors === _errs87){
if(Array.isArray(data39)){
var valid10 = true;
const len5 = data39.length;
for(let i5=0; i5<len5; i5++){
const _errs89 = errors;
if(typeof data39[i5] !== "string"){
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/matches/" + i5,schemaPath:"#/properties/supportedTargets/items/properties/matches/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid10 = _errs89 === errors;
if(!valid10){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2+"/matches",schemaPath:"#/properties/supportedTargets/items/properties/matches/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid7 = _errs87 === errors;
}
else {
var valid7 = true;
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets/" + i2,schemaPath:"#/properties/supportedTargets/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid6 = _errs72 === errors;
if(!valid6){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/supportedTargets",schemaPath:"#/properties/supportedTargets/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs70 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.uiMessage !== undefined){
const _errs91 = errors;
if(typeof data.uiMessage !== "string"){
validate20.errors = [{instancePath:instancePath+"/uiMessage",schemaPath:"#/properties/uiMessage/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs91 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.messageFailureCount !== undefined){
let data42 = data.messageFailureCount;
const _errs93 = errors;
if(errors === _errs93){
if(typeof data42 == "number"){
if(data42 < 0 || isNaN(data42)){
validate20.errors = [{instancePath:instancePath+"/messageFailureCount",schemaPath:"#/properties/messageFailureCount/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/messageFailureCount",schemaPath:"#/properties/messageFailureCount/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid0 = _errs93 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.leetcodeDetectionWarning !== undefined){
const _errs95 = errors;
if(typeof data.leetcodeDetectionWarning !== "string"){
validate20.errors = [{instancePath:instancePath+"/leetcodeDetectionWarning",schemaPath:"#/properties/leetcodeDetectionWarning/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs95 === errors;
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
else {
validate20.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};
