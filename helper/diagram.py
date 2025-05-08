from diagrams import Diagram, Cluster, Edge
from diagrams.custom import Custom
from diagrams.generic.device import Mobile
from diagrams.generic.storage import Storage

ICON_PATH = "./"
BROWSER_ICON = ICON_PATH + "browser.png"
JS_ICON = ICON_PATH + "js.png"
HTML_ICON = ICON_PATH + "html.png"
CSS_ICON = ICON_PATH + "css.png"
CHATGPT_ICON = ICON_PATH + "chatgpt.png"
CLAUDE_ICON = ICON_PATH + "claude.png"
GEMINI_ICON = ICON_PATH + "gemini.png"
PERPLEXITY_ICON = ICON_PATH + "perplexity.png"
DEEPSEEK_ICON = ICON_PATH + "deepseek.png"

with Diagram("Rakuzaichi Architecture", show=False, direction="TB"):
    user = Mobile("User\n(Interacts with chatbots)")
    
    with Cluster("Browser Extension"):
        browser = Custom("Browser", BROWSER_ICON)
        
        with Cluster("Core Components"):
            manifest = Custom("manifest.json\n(Configuration)", JS_ICON)
            
            with Cluster("UI Layer"):
                popup = Custom("popup.html\n(Export Interface)", HTML_ICON)
                styles = Custom("styles.css\n(Styling)", CSS_ICON)
                popup_js = Custom("popup.js\n(UI Logic)", JS_ICON)
                
            with Cluster("Background Services"):
                background = Custom("background.js\n(Download Handler)", JS_ICON)
                converters = Custom("converters.js\n(Format Conversion)", JS_ICON)
                
            with Cluster("Content Scripts"):
                detectors = Custom("detectors.js\n(Platform Identification)", JS_ICON)
                extractors = Custom("extractors.js\n(Message Parsing)", JS_ICON)
                
        storage = Storage("Local Storage\n(Settings/Cache)")

    # Chatbot platforms
    with Cluster("Supported Chatbots"):
        chatgpt = Custom("", CHATGPT_ICON)
        claude = Custom("", CLAUDE_ICON)
        gemini = Custom("", GEMINI_ICON)
        perplexity = Custom("", PERPLEXITY_ICON)
        deepseek = Custom("", DEEPSEEK_ICON)

    # Relationships
    user >> Edge(label="1. Chat interaction") >> gemini
    user >> Edge(label="2. Trigger export") >> browser
    
    browser >> Edge(label="3. Load UI") >> popup
    popup >> Edge() << styles
    popup >> Edge(label="4. User action") >> popup_js
    popup_js >> Edge(label="5. Request data") >> background
    
    background >> Edge(label="6. Identify platform") >> detectors
    detectors >> Edge(label="7. Select extractor") >> extractors
    extractors >> Edge(label="8. Parse messages") >> gemini
    
    extractors >> Edge(label="9. Raw data") >> converters
    converters >> Edge(label="10. Formatted data") >> background
    background >> Edge(label="11. Create file") >> storage
    background >> Edge(label="12. Initiate download") >> user
    
    manifest >> Edge(style="dashed") >> [popup, background, detectors]
    storage << Edge(style="dashed") << converters

print("Diagram generated as rakuzaichi_architecture.png")
