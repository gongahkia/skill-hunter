/* An extension-owned broker serializes annotation writes across tabs and popups. */
if (typeof importScripts === "function") importScripts("annotationStore.js");
const api = globalThis.browser || globalThis.chrome;
const store = globalThis.JudgemanAnnotationStore.createStore(api.storage.local);
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== "JUDGEMAN_ANNOTATIONS") return false;
  if (sender.id !== api.runtime.id) {
    sendResponse({ok:false, error:"Annotation request is not from this extension."});
    return false;
  }
  void store.dispatch(request).then(
    data => sendResponse({ok:true, data}),
    () => sendResponse({ok:false, error:"Annotations could not be saved or read. Storage may be unavailable, full or corrupt; existing data was retained."})
  );
  return true;
});
