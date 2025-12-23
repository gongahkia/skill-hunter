[![judgeman_1.0.0](https://img.shields.io/badge/judgeman_1.0-passing-10B981)](https://github.com/gongahkia/judgeman/releases/tag/1.0)
[![judgeman_2.0.0](https://img.shields.io/badge/judgeman_2.0-passing-059669)](https://github.com/gongahkia/judgeman/releases/tag/2.0)
[![judgeman_3.0.0](https://img.shields.io/badge/judgeman_3.0-passing-047857)](https://github.com/gongahkia/judgeman/releases/tag/3.0)
[![judgeman_4.0.0](https://img.shields.io/badge/judgeman_4.0-passing-065F46)](https://github.com/gongahkia/judgeman/releases/tag/4.0)

# `Judgeman`

Browser extension that formats cases to be more readable.

## Motivation

[ELIT](https://www.elitigation.sg/_layouts/IELS/HomePage/Pages/Home.aspx) is one of the largest publicly available repositories for Singapore's law cases. However, the website is hard to navigate through and makes cases difficult to read. Important information is often lost in walls of text.

`Judgeman` reduces the overly complex DOM structure of the webpage to one that is easily understood and can be parsed by lawyers and programmers alike.

## Purpose

* BLUF, important case information is laid bare
* Speed up reading cases on ELIT
* Browser extension with small source code binary
* Supported on most browsers

## Screenshots

![](./asset/1.png)  
![](./asset/2.png)  
![](./asset/3.png)  

## Installation

### CLI

```console
$ git clone https://github.com/gongahkia/judgeman
$ cd judgeman
$ rm -r README.md sample
```

### GUI

1. Click *Code*.

![](./archive/judgeman_v1/asset/install-1.png)

2. Click *Download ZIP*.

![](./archive/judgeman_v1/asset/install-2.png)

3. Unzip the ZIP file. 

## Usage

### Firefox
1. Copy and paste this link in the search bar *about:debugging#/runtime/this-firefox*.
2. Click *load temporary add-on*.
3. Open the `judgeman` repo, select `manifest.json`.
4. Open any **elit** page.
5. Click the toggle button.

### Chrome

1. Copy and paste this link in the search bar *chrome://extensions/*.
2. Toggle *Developer mode* on.
3. Click *load unpacked*.
4. Open the `judgeman` repo, click *select*.
5. Open any **elit** page.
6. Click the toggle button.

Support for other browsers like Opera, Vivaldi have not been extensively tested, but this extension should work. Open an issue for further support.

## References

The name `Judgeman` is in reference to the cursed technique of [Hiromi Higuruma](https://jujutsu-kaisen.fandom.com/wiki/Hiromi_Higuruma) (日車寛見), a defense attorney who rose to prominence in the [culling game arc](https://jujutsu-kaisen.fandom.com/wiki/Culling_Game_Arc) of the manga series [Jujutsu Kaisen](https://jujutsu-kaisen.fandom.com/wiki/Jujutsu_Kaisen_Wiki).

![](https://64.media.tumblr.com/2a449b56b7bf13ef94308fa4708b71fc/9f2fa11c67b698f5-4b/s1280x1920/83db52625d6df7b945b482183d12542a561407ab.png)
