import { createHash } from "node:crypto";

/** Add copied extension files to the generated Xcode project's resource build phase. */
export function syncResourceReferences(project, fileNames) {
  const groups = [...project.matchAll(/[A-F0-9]{24} \/\* Resources \*\/ = \{\s*isa = PBXGroup;[\s\S]*?\n\t\t\};/g)];
  let group = groups.find(match => match[0].includes("browserApi.js"))?.[0];
  const phases = [...project.matchAll(/[A-F0-9]{24} \/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;[\s\S]*?\n\t\t\};/g)];
  let phase = phases.find(match => match[0].includes("browserApi.js in Resources"))?.[0];
  if (!group || !phase) throw new Error("Cannot identify the Safari extension resource group and build phase.");
  const originalGroup = group, originalPhase = phase;
  for (const name of [...fileNames].sort()) {
    if (!/^[A-Za-z0-9.-]+$/.test(name)) throw new Error("Unsupported Safari resource file name.");
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`/\\* ${escaped} in Resources \\*/`).test(phase)) continue;
    const id = kind => createHash("sha256").update(`judgeman.resource.${kind}.${name}`).digest("hex").slice(0,24).toUpperCase();
    let ref = new RegExp(`([A-F0-9]{24}) /\\* ${escaped} \\*/ = \\{isa = PBXFileReference;[^\\n]*path = Resources/${escaped};`).exec(project)?.[1];
    if (!ref) {
      ref = id("file");
      const type = name.endsWith(".js") ? "sourcecode.javascript" : name.endsWith(".css") ? "text.css" : name.endsWith(".json") ? "text.json" : "text.html";
      project = project.replace("/* End PBXFileReference section */", `\t\t${ref} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = ${type}; name = ${name}; path = Resources/${name}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`);
    }
    const build = id("build");
    project = project.replace("/* End PBXBuildFile section */", `\t\t${build} /* ${name} in Resources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${name} */; };\n/* End PBXBuildFile section */`);
    if (!group.includes(ref)) group = group.replace("children = (", `children = (\n\t\t\t\t${ref} /* ${name} */,`);
    phase = phase.replace("files = (", `files = (\n\t\t\t\t${build} /* ${name} in Resources */,`);
  }
  return project.replace(originalGroup, group).replace(originalPhase, phase);
}
