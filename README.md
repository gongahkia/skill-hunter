[![](https://img.shields.io/badge/owl_1.0.0-passing-green)](https://github.com/gongahkia/owl/releases/tag/1.0.0)
[![](https://img.shields.io/badge/owl_1.0.1-passing-green)](https://github.com/gongahkia/owl/releases/tag/1.0.1)
[![](https://img.shields.io/badge/owl_2.0.0-build-orange)](https://github.com/gongahkia/owl/releases/tag/2.0.0)

> [!IMPORTANT]  
> Please read through [this disclaimer](#disclaimer) before using [Owl](https://github.com/gongahkia/owl).  

# `Owl` 🦉

Watches your google editors.

[Owl](https://github.com/gongahkia/owl) is a highly [customisable](#colorschemes), [extensible](#configurations) extension that monitors, collates and organises [your tags](#tags) on your google editors.

It works for Google [docs](#docs-owl), [sheets](#sheets-owl) and [slides](#slides-owl).

## Rationale

Since I started taking law modules in August 2023, I've found it necessary to flag specific cases, rulings and analysis for later review, rework, or revision.

Resultingly, I have more than once found myself wishing for native support for [code annotations](https://docs.github.com/en/contributing/writing-for-github-docs/annotating-code-examples) *(especially [those](https://medium.com/@wcpines/using-comment-annotations-cd06415ef71a) in the TODO, FIXME, NOTE, TBD family)* within the Google editor suite. Another close analogue would be Vim [marks](https://vim.fandom.com/wiki/Using_marks), addressed by the [ThePrimeagen](https://www.youtube.com/c/theprimeagen)'s fantastic marks manager, [Harpoon](https://github.com/ThePrimeagen/harpoon).

However, the closest I could ever get to replicating that experience in Google Editors was finding with `Ctrl + F`, or commenting with `Ctrl + Alt + M`.

Importantly, I needed a frictionless solution that complemented my existing notetaking workflow and did not slow me down by requiring learning a new keybind.

With these considerations in mind, I created [Owl](https://github.com/gongahkia/owl).

![](./asset/screenshot/rationale.png)

## Screenshot

### Docs Owl

![](./asset/screenshot/docsFilled.png)
![](./asset/screenshot/docsEmpty.png)

### Sheets Owl

![](./asset/screenshot/sheetsFilled.png)
![](./asset/screenshot/sheetsEmpty.png)

### Slides Owl

![](./asset/screenshot/slidesFilled.png)
![](./asset/screenshot/slidesEmpty.png)

## Tags

The below tags are currently supported.

| Tag | Purpose | Example |
| :--- | :--- | :--- |
| `TODO` | Task to be completed in the future | ![](./asset/screenshot/todo.png) |
| `FIXME` | Signposts areas that require explicit urgent attention  | ![](./asset/screenshot/fixme.png) |
| `REV` | Signposts areas that require less urgent revision | ![](./asset/screenshot/rev.png) |
| `TEMP` | Denotes temporary placeholder text | ![](./asset/screenshot/temp.png) |
| `REF` | Points to a reference, generally to more detailed documentation, resources or bibliography | ![](./asset/screenshot/ref.png) |

> [!TIP]  
> More tags *(or custom tags)* might be added in the future. Open an issue to feedback!

## Colorschemes

Find instructions to change your colorscheme [here](#configurations).

| Colorscheme | Example |
| :--- | :---: |
| Gruvbox | ![](./asset/screenshot/gruvbox.png) |
| Everforest | ![](./asset/screenshot/everforest.png) |
| Tokyo Night | ![](./asset/screenshot/tokyoNight.png) |
| Atom Dark | ![](./asset/screenshot/atomDark.png) |
| Monokai | ![](./asset/screenshot/monokai.png) |
| Github | ![](./asset/screenshot/github.png) |
| Ayu | ![](./asset/screenshot/ayu.png) |
| Dracula | ![](./asset/screenshot/dracula.png) |
| Rose Pine | ![](./asset/screenshot/rosePine.png) |
| Spacemacs | ![](./asset/screenshot/spacemacs.png) |

## Configurations

For detailed installation and configuration instructions, see [`INSTRUCTIONS.md`](./INSTRUCTIONS.md).

## Deployment 

| Editor platform | Status | Link | 
| :--- | :--- | :--- |  
| [Google Docs](./src/docs/) | ![](https://img.shields.io/badge/Status-%20Up-green) | [docs.google](https://docs.google.com) |
| [Google Sheets](./src/sheets/) | ![](https://img.shields.io/badge/Status-%20Up-green) | [sheets.google](https://sheets.google.com) |
| [Google Slides](./src/slides/) | ![](https://img.shields.io/badge/Status-%20Up-green) | [slides.google](https://slides.google.com) |
| Google Workspace Marketplace | ![](https://img.shields.io/badge/Status-Pending%20Approval-yellow) | [workspace.google.com/marketplace](https://workspace.google.com/marketplace/search/) |

## Disclaimer

The `Owl` extension is provided "as is" and without any warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.

By using this extension, you acknowledge and agree to the following:

1. **No Liability for Malfunction**: The developer of the `Owl` extension shall not be liable for any direct, indirect, incidental, special, consequential damages, or any damages whatsoever arising out of or in connection with the use of this extension. This includes but is not limited to:

    * Data loss
    * Corruption of files
    * Interruption of service
    * Any other issues that may arise as a result of using this extension

2. **User Responsibility**: You are solely responsible for ensuring that you have adequate backups of your data and that you understand the risks associated with using this extension. 

3. **Compliance with Laws**: You are responsible for ensuring compliance with all applicable laws and regulations regarding the use of this extension and any data it may process.

4. **Modification and Updates**: The developer reserves the right to modify or discontinue the extension at any time without notice. The functionality may change over time, and while efforts will be made to keep it stable, no guarantees are made regarding its performance.

5. **Third-Party Services**: The `Owl` extension interacts with third-party services (such as Google Docs, Sheets, and Slides). The developer is not responsible for any issues arising from these interactions or from changes in third-party services.

6. **Indemnification**: You agree to indemnify and hold harmless the developer from any claims, losses, liabilities, damages, costs, or expenses (including reasonable attorney fees) arising out of your use of this extension.

7. **Disclaimer changes**: This disclaimer is subject to change without notice. Please review it periodically for updates.

## References

The name `Owl` is in reference to the [second technique](https://kagurabachi.fandom.com/wiki/Seiichi_Samura#Techniques) of [Tobimune](https://kagurabachi.fandom.com/wiki/Enchanted_Blade#Tobimune) (飛宗), the [enchanted blade](https://kagurabachi.fandom.com/wiki/Enchanted_Blade) wielded by the contracted sword bearer [Seiichi Samura](https://kagurabachi.fandom.com/wiki/Seiichi_Samura) (座村清市) during the [Seitei War](https://kagurabachi.fandom.com/wiki/Seitei_War). [Owl](https://kagurabachi.fandom.com/wiki/Seiichi_Samura#Techniques) first appears during the [Sword Bearer Assassination arc](https://kagurabachi.fandom.com/wiki/Sword_Bearer_Assassination_Arc) of the manga series [Kagurabachi](https://kagurabachi.fandom.com/wiki/Kagurabachi_Wiki).

![](./asset/logo/owl.png)
