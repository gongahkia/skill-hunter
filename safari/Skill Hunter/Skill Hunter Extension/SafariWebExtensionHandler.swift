//
//  SafariWebExtensionHandler.swift
//  Skill Hunter Extension
//
//  Created by Gabriel Ong Zhe Mian on 20/3/26.
//

import SafariServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        context.completeRequest(returningItems: [], completionHandler: nil)
    }
}
