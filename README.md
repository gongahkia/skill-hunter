![Static Badge](https://img.shields.io/badge/CFP_1.0-passing-green)

# Case Facts Parser

Browser extension that formats cases to be more readable.

## Motivation

[ELIT](https://www.elitigation.sg/_layouts/IELS/HomePage/Pages/Home.aspx) is one of the largest publicly available repositories for Singapore's law cases. However, the website is hard to navigate through and makes cases difficult to read. Important information is often lost in walls of text.

`CFP` reduces the overly complex DOM structure of the webpage to one that is easily understood and can be parsed by lawyers and programmers alike.

## Purpose

* BLUF, important case information is laid bare
* Speed up reading cases on ELIT
* Browser extension with small source code binary
* Supported on most browsers

## Screenshots

![](sample/screenshot-1.png)

## Installation

```console
$ git clone https://github.com/gongahkia/cfp
```

## Usage

### Firefox
1. Open this [link](about:debugging#/runtime/this-firefox).
2. Click *load temporary add-on*.
3. Open the `CFP` repo, select `./src/manifest.json`
4. Open any **elit** page
5. Click the toggle button

### Chrome

1. Open this [link](chrome://extensions/)
2. Click *load unpacked*
3. Open the `CFP` repo, select `./src/manifest.json`
4. Open any **elit** page
5. Click the toggle button

> Working out support for other browsers
> Add video here later
