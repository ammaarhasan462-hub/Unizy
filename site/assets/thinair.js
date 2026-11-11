/* Unizy Play: "Thin Air", the daily rare-answer game.
   Seven prompts a day ("A fruit", "A Roman emperor"...), 20 seconds each. Any accepted answer scores, but rarer
   answers score more (Grounded 10, Cloudline 25, Jet Stream 50, Stratos 75, Thin Air 100). An answer that isn't
   on the list can be retried until time runs out. One Thermal per run doubles a single answer. Points lift a
   balloon (1 point = 150 m); a perfect run passes the 100 km line. Same prompts for everyone each day (UK date);
   the first go counts on the leaderboard, then it's free climbs. */
(function () {
  'use strict';
  var BANK = [
  ["A country in Europe",
   "france|germany|spain|italy|united kingdom/uk/britain/great britain",
   "portugal|greece|netherlands/holland|belgium|switzerland|austria|poland|ireland/republic of ireland|sweden|norway|denmark|england|scotland|wales|russia|ukraine",
   "finland|iceland|czech republic/czechia|hungary|romania|croatia|turkey/turkiye|serbia|bulgaria|slovakia",
   "slovenia|estonia|latvia|lithuania|belarus|bosnia and herzegovina/bosnia|albania|montenegro|north macedonia/macedonia|moldova|luxembourg|cyprus|malta|kosovo|northern ireland",
   "andorra|liechtenstein|monaco|san marino|vatican city/vatican/holy see"],
  ["A fruit",
   "apple|banana|orange|strawberry|grape|mango",
   "pear|pineapple|watermelon|cherry|peach|kiwi/kiwifruit|lemon|blueberry|raspberry|plum|melon",
   "lime|grapefruit|apricot|coconut|pomegranate|papaya|blackberry|nectarine|fig|avocado|tomato|passion fruit/passionfruit|cantaloupe|clementine|tangerine|satsuma",
   "lychee/litchi|guava|date|cranberry|gooseberry|kumquat|persimmon|quince|dragon fruit/pitaya|star fruit/carambola|mandarin|honeydew|redcurrant/red currant|blackcurrant/black currant|elderberry|olive|plantain|jackfruit|boysenberry|mulberry|pomelo",
   "durian|rambutan|mangosteen|loquat|feijoa|cherimoya|soursop|salak/snake fruit|longan|tamarind|medlar|ugli fruit/ugli|yuzu|physalis/cape gooseberry|pawpaw|lingonberry|cloudberry|ackee|breadfruit|jabuticaba|bilberry|sapodilla|kiwano/horned melon|damson|greengage|sloe"],
  ["A chemical element",
   "oxygen|hydrogen|carbon|gold|iron|nitrogen|helium",
   "silver|sodium|copper|calcium|chlorine|lead|potassium|neon|zinc|uranium|aluminium/aluminum|magnesium|lithium|mercury",
   "sulfur/sulphur|phosphorus|platinum|titanium|silicon|argon|fluorine|tin|nickel|plutonium|iodine|radon|cobalt|boron",
   "chromium|manganese|tungsten|bromine|krypton|xenon|arsenic|radium|beryllium|barium|caesium/cesium|strontium|bismuth|cadmium|palladium|selenium|vanadium|antimony|francium|polonium|thorium|osmium|iridium|gallium|germanium",
   "scandium|rubidium|yttrium|zirconium|niobium|molybdenum|technetium|ruthenium|rhodium|indium|tellurium|lanthanum|cerium|praseodymium|neodymium|promethium|samarium|europium|gadolinium|terbium|dysprosium|holmium|erbium|thulium|ytterbium|lutetium|hafnium|tantalum|rhenium|thallium|astatine|actinium|protactinium|neptunium|americium|curium|berkelium|californium|einsteinium|fermium|mendelevium|nobelium|lawrencium|rutherfordium|dubnium|seaborgium|bohrium|hassium|meitnerium|darmstadtium|roentgenium|copernicium|nihonium|flerovium|moscovium|livermorium|tennessine|oganesson"],
  ["A dog breed",
   "labrador/labrador retriever/lab|golden retriever|german shepherd/alsatian|poodle|bulldog|chihuahua|husky/siberian husky",
   "beagle|pug|dachshund/daschund/sausage dog|rottweiler|boxer|border collie|cocker spaniel|french bulldog/frenchie|pomeranian|great dane|dalmatian|yorkshire terrier/yorkie|shih tzu|jack russell/jack russell terrier|dobermann/doberman/doberman pinscher|corgi/welsh corgi|greyhound|staffordshire bull terrier/staffy/staffie",
   "shiba inu|akita|samoyed|bernese mountain dog|saint bernard|maltese|bichon frise|cavalier king charles spaniel/cavalier|whippet|collie/rough collie|springer spaniel/english springer spaniel|schnauzer|border terrier|bull terrier|weimaraner|vizsla|labradoodle|cockapoo|newfoundland|basset hound|bloodhound|mastiff|pit bull/pitbull|chow chow|shar pei|australian shepherd|alaskan malamute/malamute|west highland terrier/westie/west highland white terrier|scottish terrier/scottie|papillon|pekingese|afghan hound|irish setter|old english sheepdog",
   "rhodesian ridgeback|basenji|saluki|borzoi|irish wolfhound|lhasa apso|keeshond|leonberger|great pyrenees/pyrenean mountain dog|airedale/airedale terrier|bedlington terrier|cairn terrier|norfolk terrier|norwich terrier|shetland sheepdog/sheltie|italian greyhound|havanese|bolognese|cane corso|dogue de bordeaux|boston terrier|kerry blue terrier|gordon setter|english setter|pointer|brittany|bullmastiff|anatolian shepherd|belgian malinois/malinois|tibetan mastiff|tibetan terrier|coton de tulear|xoloitzcuintli/xolo|chinese crested",
   "lagotto romagnolo|komondor|puli|kooikerhondje|otterhound|sloughi|azawakh|thai ridgeback|catahoula|plott hound|bergamasco|mudi|pumi|norwegian lundehund/lundehund|dandie dinmont terrier|skye terrier|sealyham terrier|glen of imaal terrier|cesky terrier|affenpinscher|schipperke|italian spinone/spinone|kuvasz|briard|beauceron|peruvian inca orchid|portuguese water dog|finnish spitz|stabyhoun|clumber spaniel|sussex spaniel|field spaniel|curly coated retriever|chesapeake bay retriever|nova scotia duck tolling retriever/toller"],
  ["A US state",
   "california|texas|new york|florida",
   "washington|ohio|alaska|hawaii|nevada|arizona|georgia|illinois|michigan|colorado|massachusetts|virginia|new jersey|pennsylvania|oregon|utah|tennessee|louisiana",
   "north carolina|south carolina|alabama|kentucky|minnesota|wisconsin|indiana|missouri|maryland|connecticut|oklahoma|kansas|iowa|mississippi|new mexico|maine|vermont|montana|idaho",
   "arkansas|nebraska|west virginia|new hampshire|rhode island|delaware|wyoming",
   "north dakota|south dakota"],
  ["A capital city in Asia",
   "tokyo|beijing|seoul|new delhi/delhi|bangkok",
   "kabul|islamabad|dhaka|jakarta|manila|singapore|kuala lumpur|hanoi|tehran|baghdad|riyadh|doha|abu dhabi|taipei|kathmandu|beirut|damascus",
   "colombo|phnom penh|vientiane|ulaanbaatar/ulan bator|pyongyang|muscat|kuwait city|amman|sanaa|ankara|tashkent|astana|baku|tbilisi|yerevan|nicosia",
   "bishkek|dushanbe|thimphu|male|naypyidaw/nay pyi taw|manama",
   "bandar seri begawan|dili|sri jayawardenepura kotte/kotte|ashgabat"],
  ["A musical instrument",
   "piano|guitar|drums/drum|violin|flute",
   "trumpet|saxophone/sax|cello|clarinet|bass guitar/bass|harp|keyboard|ukulele|trombone|harmonica|tuba|recorder|xylophone|tambourine|triangle|organ|accordion|banjo",
   "viola|double bass/upright bass|oboe|bassoon|french horn/horn|piccolo|cymbals/cymbal|bagpipes/bagpipe|mandolin|sitar|harpsichord|glockenspiel|maracas|bongos|cornet|euphonium|synthesizer/synth|timpani|castanets|kazoo|steel drum/steel pan/steelpan",
   "lute|didgeridoo|marimba|vibraphone|cor anglais/english horn|tabla|djembe|bodhran|zither|balalaika|sousaphone|flugelhorn|tin whistle/penny whistle|ocarina|panpipes/pan flute/pan pipes|celesta|dulcimer|kalimba/mbira|koto|shamisen|erhu|gong|cajon|theremin|melodica|concertina|bugle",
   "hurdy gurdy|sackbut|crumhorn|shawm|ophicleide|serpent|theorbo|nyckelharpa|oud|bouzouki|duduk|guzheng|pipa|shakuhachi|gamelan|handpan/hang|kora|charango|bandoneon|ondes martenot|glass harmonica|sarangi|santoor|veena|tanpura|cimbalom|dizi|sheng|angklung|rebec|viol|contrabassoon|heckelphone|kantele"],
  ["A Shakespeare play",
   "romeo and juliet|hamlet|macbeth",
   "othello|king lear|a midsummer night's dream|the tempest|julius caesar|much ado about nothing|twelfth night|the merchant of venice",
   "the taming of the shrew|as you like it|richard iii/richard 3|henry v/henry 5|antony and cleopatra|the winter's tale|the comedy of errors|richard ii/richard 2",
   "henry iv/henry 4/henry iv part 1/henry iv part 2|measure for measure|coriolanus|titus andronicus|the merry wives of windsor|all's well that ends well|troilus and cressida|king john|cymbeline|love's labour's lost/loves labors lost|henry viii/henry 8|timon of athens",
   "pericles/pericles prince of tyre|the two gentlemen of verona|henry vi/henry 6/henry vi part 1/henry vi part 2/henry vi part 3|the two noble kinsmen|edward iii/edward 3"],
  ["A sport played with a ball",
   "football/soccer|basketball|tennis|cricket|rugby|golf",
   "baseball|volleyball|american football|netball|hockey/field hockey|table tennis/ping pong|bowling|squash|handball|snooker|pool|water polo|dodgeball|softball|rounders",
   "lacrosse|polo|billiards|croquet|beach volleyball|futsal|gaelic football|hurling|kickball|racquetball|padel|pickleball|bowls/lawn bowls|petanque/boules",
   "korfball|sepak takraw|jai alai/pelota|goalball|rugby league|rugby union|aussie rules/australian rules football/afl|bocce|camogie|fives|real tennis|shinty|pesapallo|canoe polo|footvolley|teqball|underwater rugby",
   "kin ball|bossaball|bandy|stoolball|eton fives|calcio storico|chinlone|lapta|tchoukball|wallyball|roque|pato|cuju|kemari"],
  ["A planet or moon in our Solar System",
   "earth|mars|jupiter|saturn|the moon/moon",
   "venus|mercury|neptune|uranus|pluto",
   "titan|europa|io|ganymede|callisto|phobos|deimos|triton|enceladus|charon|ceres",
   "mimas|iapetus|rhea|dione|tethys|hyperion|miranda|titania|oberon|ariel|umbriel|eris|makemake|haumea|nereid",
   "amalthea|himalia|thebe|metis|adrastea|elara|pan|daphnis|atlas|prometheus|pandora|epimetheus|janus|phoebe|puck|proteus|larissa|naiad|thalassa|despina|galatea|nix|hydra|kerberos|styx|dysnomia|sedna|gonggong|quaoar|orcus|vanth|calypso|telesto|helene|cordelia|ophelia|bianca|cressida|desdemona|juliet|portia|rosalind|belinda|caliban|sycorax|pasiphae|sinope|carme|ananke|leda"],
  ["A vegetable",
   "carrot|potato|broccoli|onion|lettuce|cucumber",
   "peas/pea|cabbage|spinach|cauliflower|pepper/bell pepper|sweetcorn/corn|tomato|mushroom|celery|garlic|sweet potato|green beans/green bean|courgette/zucchini|aubergine/eggplant|leek|kale|beans/bean",
   "asparagus|brussels sprouts/brussels sprout/sprouts|beetroot/beet|radish|parsnip|artichoke|turnip|swede/rutabaga|pumpkin|squash|butternut squash|okra/ladies fingers|pak choi/bok choy|chilli/chili|shallot|spring onion/scallion|rocket/arugula|watercress",
   "fennel|kohlrabi|celeriac|swiss chard/chard|endive|chicory|yam|cassava|taro|jerusalem artichoke|daikon/mooli|radicchio|samphire|broad bean/fava bean|edamame|runner bean|mangetout/snow pea|sugar snap pea|romanesco|tenderstem/broccolini|gai lan/kai lan/chinese broccoli|lotus root|bamboo shoots/bamboo shoot|water chestnut",
   "salsify|scorzonera|celtuce|oca|ulluco|jicama|burdock|kalettes|cardoon|sea kale|tatsoi|mizuna|komatsuna|choy sum|bitter melon/bitter gourd/karela|chayote/choko|malanga|crosne|skirret|purslane|nettle|fiddlehead|dandelion"],
  ["A Greek god or goddess",
   "zeus|poseidon|hades|athena/athene|aphrodite",
   "apollo|ares|hera|hermes|artemis|dionysus|hephaestus|demeter|kronos/cronus",
   "persephone|hestia|eros|nike|gaia/gaea|helios|selene|eos|pan|hecate|nemesis|ouranos/uranus|rhea|morpheus|hypnos|thanatos|prometheus|atlas|iris|tyche|asclepius",
   "hebe|nyx|erebus|chaos|tartarus|oceanus|tethys|hyperion|themis|mnemosyne|metis|leto|eris|harmonia|triton|amphitrite|boreas|zephyrus|notus|eurus|aeolus|plutus|priapus|eileithyia|enyo|deimos|phobos",
   "coeus|crius|iapetus|theia|epimetheus|menoetius|aether|hemera|pontus|nereus|proteus|thaumas|phorcys|ceto|styx|despoina|ananke|chronos|palaemon|leucothea|aristaeus|hymenaios/hymen|pheme|zelus|kratos|bia|momus|oizys|geras|elpis|achlys"],
  ["A London Tube line (Elizabeth line counts)",
   "central|northern|victoria|jubilee|piccadilly",
   "district|circle|metropolitan|bakerloo|elizabeth",
   "hammersmith and city/hammersmith",
   "",
   "waterloo and city/waterloo"],
  ["A US president",
   "george washington/washington|abraham lincoln/lincoln|barack obama/obama|donald trump/trump|joe biden/biden",
   "john f kennedy/jfk/kennedy|ronald reagan/reagan|bill clinton/clinton|george w bush/george bush/bush|franklin d roosevelt/fdr/franklin roosevelt|theodore roosevelt/teddy roosevelt/roosevelt|thomas jefferson/jefferson|richard nixon/nixon",
   "jimmy carter/carter|george h w bush|john adams/adams|dwight eisenhower/eisenhower/ike|harry truman/truman|andrew jackson/jackson|james madison/madison|woodrow wilson/wilson|lyndon b johnson/lbj/lyndon johnson/johnson|gerald ford/ford|ulysses s grant/grant",
   "james monroe/monroe|john quincy adams|herbert hoover/hoover|calvin coolidge/coolidge|william mckinley/mckinley|james k polk/polk|grover cleveland/cleveland|william howard taft/taft|warren g harding/harding|andrew johnson|james garfield/garfield",
   "martin van buren/van buren|william henry harrison|john tyler/tyler|zachary taylor/taylor|millard fillmore/fillmore|franklin pierce/pierce|james buchanan/buchanan|rutherford b hayes/hayes|chester a arthur/chester arthur/arthur|benjamin harrison/harrison"],
  ["A programming language",
   "python|javascript/js|java|c++/cpp|c",
   "c#/csharp|html|css|sql|php|ruby|swift|go/golang|typescript/ts|rust|kotlin",
   "r|matlab|perl|scala|dart|lua|bash/shell|assembly/asm|visual basic/vb/vba|objective-c/objective c/objc|haskell|fortran|cobol|pascal|scratch|julia|groovy|powershell",
   "lisp|common lisp|scheme|racket|clojure|erlang|elixir|f#/fsharp|ocaml|prolog|ada|delphi|smalltalk|basic|zig|nim|crystal|elm|solidity|apl|sas|abap|vhdl|verilog|tcl|coffeescript|actionscript|logo|awk|d",
   "befunge|forth|simula|algol|ml|standard ml|idris|agda|coq|j|k|q|chapel|hack|pony|rebol|oberon|modula-2/modula 2|eiffel|snobol|whitespace|malbolge|intercal|lolcode|piet|rexx|pl/i|jovial|mumps|haxe|vala|odin|gleam|carbon|mojo"],
  ["A country in Africa",
   "egypt|south africa|nigeria|kenya|morocco",
   "ethiopia|ghana|algeria|tunisia|libya|sudan|somalia|uganda|tanzania|zimbabwe|cameroon|senegal|madagascar|dr congo/democratic republic of the congo/drc/congo|angola|rwanda",
   "zambia|mozambique|namibia|botswana|ivory coast/cote d'ivoire|mali|niger|chad|south sudan|malawi|sierra leone|liberia|eritrea|mauritius|the gambia/gambia|republic of the congo/congo brazzaville|seychelles|cape verde/cabo verde",
   "burkina faso|benin|togo|guinea|guinea-bissau/guinea bissau|gabon|equatorial guinea|central african republic/car|burundi|djibouti|lesotho|eswatini/swaziland|mauritania|comoros",
   "sao tome and principe/sao tome"],
  ["A bird",
   "eagle|robin|pigeon|parrot|penguin|owl|chicken|crow",
   "sparrow|duck|swan|flamingo|ostrich|hawk|falcon|seagull/gull|peacock/peafowl|turkey|goose|blackbird|magpie|woodpecker|hummingbird|toucan|vulture|dove|budgie/budgerigar/parakeet|emu|kiwi|starling|pelican|canary",
   "kingfisher|heron|stork|crane|wren|finch|goldfinch|cardinal|raven|jackdaw|rook|puffin|albatross|cormorant|kestrel|buzzard|condor|macaw|cockatoo|osprey|swallow|swift|nightingale|skylark/lark|thrush|blue tit|great tit|pheasant|grouse|quail|partridge|ibis|roadrunner|kookaburra|cuckoo|jay|blue jay|bluebird|oriole|mockingbird|cassowary|rhea|lovebird|mallard|red kite/kite",
   "nuthatch|treecreeper|wagtail|dunnock|chaffinch|bullfinch|greenfinch|siskin|linnet|yellowhammer|redstart|stonechat|wheatear|warbler|chiffchaff|goldcrest|kittiwake|guillemot|razorbill|gannet|fulmar|shearwater|petrel|tern|avocet|curlew|lapwing|plover|sandpiper|snipe|woodcock|oystercatcher|coot|moorhen|grebe|loon/diver|bittern|egret|spoonbill|hoopoe|bee-eater/bee eater|hornbill|lyrebird|bowerbird|weaver|tanager|grackle|cowbird|chickadee|junco|kea|kakapo|takahe|secretary bird|shoebill|frigatebird|booby|harrier|merlin|hobby|peregrine/peregrine falcon|goshawk|sparrowhawk|nightjar|whippoorwill|dodo|moa",
   "hoatzin|potoo|frogmouth|oilbird|tinamou|sunbittern|kagu|seriema|trogon|quetzal|motmot|jacamar|puffbird|barbet|honeyguide|wryneck|pitta|broadbill|manakin|cotinga|antbird|ovenbird|tapaculo|dipper|accentor|bushtit|wallcreeper|shrike|vireo|drongo|fantail|whistler|sittella|pardalote|gerygone|hihi|tui|saddleback|bellbird|kokako|fairywren/fairy wren|bristlebird|scrubbird|logrunner|turaco|mousebird|hammerkop|jacana|pratincole|courser|sheathbill|skua|jaeger|phalarope|dotterel|turnstone|knot|dunlin|ruff|godwit|whimbrel|smew|goosander|merganser|eider|scaup|garganey|teal|wigeon|shoveler|pintail|capercaillie|ptarmigan|corncrake|crake|rail|hawfinch|crossbill|brambling|twite|redpoll|waxwing|firecrest|ortolan"],
  ["A Premier League club (any season)",
   "manchester united/man united/man utd/man u|liverpool|arsenal|chelsea|manchester city/man city",
   "tottenham hotspur/tottenham/spurs|newcastle united/newcastle|everton|aston villa/villa|west ham united/west ham|leicester city/leicester",
   "southampton|leeds united/leeds|wolverhampton wanderers/wolves|crystal palace|brighton and hove albion/brighton|fulham|nottingham forest/forest|sunderland|brentford|bournemouth/afc bournemouth|burnley|west bromwich albion/west brom|stoke city/stoke|norwich city/norwich|watford",
   "middlesbrough/boro|blackburn rovers/blackburn|bolton wanderers/bolton|sheffield united|ipswich town/ipswich|wigan athletic/wigan|portsmouth|queens park rangers/qpr|hull city/hull|swansea city/swansea|derby county/derby|cardiff city/cardiff|charlton athletic/charlton|birmingham city/birmingham|reading|luton town/luton|coventry city/coventry|huddersfield town/huddersfield|sheffield wednesday",
   "barnsley|blackpool|bradford city/bradford|oldham athletic/oldham|swindon town/swindon|wimbledon"],
  ["A cheese",
   "cheddar|mozzarella|brie|parmesan/parmigiano reggiano/parmigiano|feta",
   "camembert|gouda|stilton|edam|halloumi|swiss|blue cheese|cream cheese|ricotta|mascarpone|emmental/emmentaler|gruyere|red leicester|goat's cheese/goats cheese/goat cheese|cottage cheese|roquefort",
   "gorgonzola|manchego|wensleydale|double gloucester|monterey jack|pecorino|provolone|paneer|burrata|colby|jarlsberg|havarti|caerphilly|lancashire|cheshire|american cheese|pepper jack|comte|raclette|taleggio|fontina|boursin|babybel",
   "reblochon|munster|epoisses|vacherin/vacherin mont d'or|beaufort|morbier|saint agur|port salut|tomme|asiago|grana padano|scamorza|stracciatella|queso fresco|cotija|oaxaca|labneh|quark|kefalotyri|graviera|manouri|leerdammer|limburger|tilsit|cambozola|danish blue|shropshire blue|stinking bishop|cornish yarg/yarg|lincolnshire poacher|dolcelatte|ossau iraty|mimolette|bocconcini",
   "casu marzu|caciocavallo|castelmagno|bitto|fiore sardo|idiazabal|mahon|cabrales|torta del casar|valdeon|zamorano|tetilla|banon|chaource|langres|livarot|pont l'eveque|maroilles|abondance|salers|cantal|laguiole|selles sur cher|crottin de chavignol/crottin|sainte maure|tete de moine|appenzeller|sbrinz|herve|gamalost|brunost/gjetost|vasterbotten|oscypek|bryndza|kashkaval|sirene|chhena|kalari|rushan|stichelton|beenleigh blue|tunworth|berkswell|sage derby|swaledale|cornish blue|baron bigod"],
  ["A colour",
   "red|blue|green|yellow|orange|purple|pink|black|white",
   "brown|grey/gray|silver|gold|violet|turquoise|beige|navy/navy blue|cyan|magenta|maroon|indigo|lilac|cream|lime",
   "teal|crimson|scarlet|burgundy|lavender|mauve|olive|khaki|tan|coral|peach|aqua|ivory|amber|bronze|emerald|ruby|sapphire|mint|salmon|charcoal|fuchsia|plum|mustard|rust|sky blue|royal blue|jade",
   "vermilion/vermillion|cerulean|ochre|sienna|umber|ultramarine|cobalt|chartreuse|periwinkle|puce|taupe|ecru|sepia|mahogany|aubergine|cerise|carmine|aquamarine|azure|ebony|cinnabar|saffron|lemon|apricot|celadon|heliotrope|slate|gunmetal|burnt orange|terracotta|sand|denim|cornflower|oxblood|wine",
   "eau de nil|gamboge|falu red|smalt|zaffre|glaucous|wenge|xanadu|feldgrau|isabelline|coquelicot|amaranth|byzantium|celeste|fallow|fulvous|gainsboro|liver|mikado|mulberry|razzmatazz|sarcoline|skobeloff|tenne|nankeen|caput mortuum|drab|bistre|chamoisee|eburnean|incarnadine|wisteria"],
  ["A Roman emperor",
   "augustus|nero|caligula|marcus aurelius",
   "hadrian|constantine/constantine the great|tiberius|claudius|commodus|trajan|vespasian",
   "domitian|titus|diocletian|caracalla|septimius severus|antoninus pius|galba|otho|vitellius|nerva|romulus augustulus/augustulus|justinian",
   "theodosius|valerian|aurelian|elagabalus/heliogabalus|severus alexander|maximinus thrax|gordian|philip the arab|decius|gallienus|claudius gothicus|probus|carus|galerius|maximian|constantius|constans|julian/julian the apostate|jovian|valens|valentinian|gratian|honorius|arcadius|majorian|lucius verus|pertinax|didius julianus|macrinus|geta",
   "pupienus|balbinus|trebonianus gallus|aemilianus|quintillus|tacitus|florian|carinus|numerian|maxentius|licinius|maximinus daia|magnentius|vetranio|procopius|eugenius|petronius maximus|avitus|libius severus|anthemius|olybrius|glycerius|julius nepos|hostilian|volusian|herennius etruscus|diadumenian|constantine ii|constantius ii|constantius chlorus|valentinian iii|theodosius ii|zeno|anastasius|heraclius"],
  ["A currency (past or present)",
   "dollar|pound/pound sterling/sterling|euro|yen",
   "rupee|yuan/renminbi|franc|peso|rouble/ruble|won|krona|krone|bitcoin",
   "real|rand|dinar|dirham|lira|riyal/rial|baht|ringgit|rupiah|shekel|zloty|forint|naira|shilling|dong|koruna|kuna|lev|leu|drachma|deutsche mark/mark|guilder|escudo|peseta",
   "kwacha|cedi|birr|taka|kyat|riel|kip|tugrik|tenge|som|somoni|manat|lari|dram|hryvnia|denar|lek|lempira|quetzal|colon|cordoba|balboa|bolivar|guarani|sol|boliviano|gourde|kina|pula|loti|lilangeni|ariary|ouguiya|dalasi|leone|rufiyaa|ngultrum|pataca|pa'anga|tala|vatu|afghani|kwanza|nakfa|dobra",
   "florin|ducat|denarius|sestertius|solidus|thaler|groat|farthing|guinea|crown|sou|livre|cowrie|wampum|obol|talent|kopek|pfennig|centime|ecu"],
  ["A bone in the human body",
   "skull|femur|rib|tibia|humerus",
   "fibula|radius|ulna|pelvis|clavicle/collarbone|patella/kneecap|sternum/breastbone|vertebra/vertebrae|scapula/shoulder blade|mandible/jaw/jawbone|spine|hip bone/hip",
   "cranium|coccyx/tailbone|sacrum|phalanges/phalanx|metacarpals/metacarpal|metatarsals/metatarsal|tarsals/tarsal|carpals/carpal|maxilla|stapes/stirrup|incus/anvil|malleus/hammer|hyoid|ilium|ischium|pubis|calcaneus/heel bone|talus/ankle bone",
   "frontal bone/frontal|parietal|temporal|occipital|sphenoid|ethmoid|zygomatic/cheekbone|nasal bone|lacrimal|palatine|vomer|atlas|axis|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|navicular|cuboid|cuneiform|sesamoid|innominate",
   "inferior nasal concha/concha|manubrium|xiphoid process/xiphoid|fabella|os trigonum|ossicle"],
  ["A herb or spice",
   "basil|black pepper/pepper|cinnamon|mint|oregano|rosemary|parsley",
   "thyme|paprika|cumin|ginger|turmeric|coriander/cilantro|chilli/chili/chili powder/cayenne/cayenne pepper|nutmeg|sage|dill|chives|garlic|bay leaf/bay/bay leaves|cloves/clove|vanilla|saffron|curry powder/curry|mustard",
   "cardamom|star anise|fennel|tarragon|marjoram|allspice|lemongrass|fenugreek|caraway|sumac|za'atar|garam masala|mace|aniseed/anise|chervil|lovage|lemon balm|horseradish|wasabi|juniper|sesame",
   "asafoetida/hing|nigella/kalonji|ajwain/carom|galangal|makrut lime/kaffir lime/lime leaves|curry leaves/curry leaf|grains of paradise|long pepper|pink peppercorn|sichuan pepper/szechuan pepper|annatto/achiote|epazote|savory|sorrel|borage|hyssop|angelica|mahleb/mahlab|amchur/amchoor|black lime/loomi|shiso/perilla|culantro|file|tonka bean/tonka",
   "cubeb|sansho|kokum|anardana|zedoary|calamus|wattleseed|lemon myrtle|pepperberry/tasmanian pepper|rue|costmary|woodruff|sweet cicely|mugwort|lemon verbena|papalo|hoja santa|rau ram/vietnamese coriander|alexanders|bergamot|myrtle"],
  ["A tree",
   "oak|pine|maple|birch|palm|willow",
   "ash|beech|elm|cherry|apple|fir|spruce|cedar|redwood|sycamore|chestnut|horse chestnut|yew|holly|olive|eucalyptus|baobab|cypress|poplar|walnut|sequoia|lemon|orange",
   "larch|hazel|hawthorn|rowan/mountain ash|alder|lime/linden|london plane/plane|magnolia|cherry blossom|weeping willow|mahogany|teak|ebony|banyan|acacia|juniper|monkey puzzle|giant sequoia|douglas fir|aspen|cottonwood|hickory|dogwood|elder|mango|fig|coconut|almond|pecan|hemlock|jacaranda|sandalwood|rosewood",
   "hornbeam|whitebeam|field maple|blackthorn|crab apple|wild service tree|wych elm|mulberry|catalpa|tulip tree|sweetgum|ginkgo/gingko|wollemi pine|dragon tree|joshua tree|kauri|rimu|totara|pohutukawa|jarrah|karri|bunya|kapok|ceiba|mangrove|tamarind|neem|sacred fig/peepal/bodhi tree|sal|deodar|cork oak|holm oak|bristlecone pine|scots pine|stone pine|cedar of lebanon|paperbark|boab|osage orange|black locust|honey locust|buckeye|persimmon|pawpaw|sassafras|tupelo|bald cypress",
   "dawn redwood/metasequoia|araucaria|podocarpus|lacebark|snakebark maple|katsura|handkerchief tree/dove tree/davidia|paulownia|tree of heaven/ailanthus|zelkova|hackberry|ironwood|lignum vitae|quebracho|greenheart|wenge|bubinga|zebrawood|purpleheart|padauk|balsa|mopane|marula|leadwood|quiver tree|umbrella thorn|fever tree|jackalberry|frangipani|flame tree/flamboyant/royal poinciana|camphor|durian|breadfruit|ackee|moringa|arjuna|kadamba|ashoka|tamarisk|carob|terebinth|mastic|argan|dragon blood tree|frankincense|myrrh"],
  ["A gemstone",
   "diamond|ruby|emerald|sapphire",
   "amethyst|pearl|opal|topaz|jade|garnet|aquamarine|turquoise|quartz|onyx|amber",
   "peridot|citrine|tourmaline|tanzanite|jasper|lapis lazuli/lapis|moonstone|tiger's eye|agate|malachite|obsidian|zircon|coral|rose quartz|bloodstone|carnelian|spinel|alexandrite|morganite",
   "beryl|chrysoberyl|kunzite|iolite|labradorite|sunstone|chalcedony|chrysoprase|hematite|rhodochrosite|rhodonite|fluorite|sodalite|azurite|aventurine|smoky quartz|jet|cat's eye|kyanite|apatite|andalusite|tsavorite|spessartine|demantoid|moissanite|paraiba|imperial topaz|black opal|fire opal|star sapphire|padparadscha|cubic zirconia",
   "benitoite|grandidierite|painite|taaffeite|musgravite|red beryl/bixbite|jeremejevite|poudretteite|serendibite|hibonite|kornerupine|titanite/sphene|diopside|enstatite|prehnite|sugilite|charoite|larimar|ammolite|seraphinite|vesuvianite/idocrase|scapolite|danburite|phenakite|euclase|hiddenite|heliodor|goshenite|tugtupite|clinohumite|hauyne|sinhalite|petalite|pollucite|zoisite|thulite|variscite|chrysocolla|unakite|astrophyllite|eudialyte|cuprite|sphalerite|cassiterite"],
  ["A country beginning with S",
   "spain|sweden|switzerland|south africa",
   "saudi arabia|singapore|south korea|sri lanka|scotland|syria|serbia|sudan|somalia|senegal",
   "slovakia|slovenia|south sudan|samoa|sierra leone|suriname|seychelles",
   "solomon islands|san marino|saint lucia",
   "sao tome and principe/sao tome|saint kitts and nevis/saint kitts|saint vincent and the grenadines/saint vincent|swaziland"],
  ["A UK city",
   "london|manchester|birmingham|liverpool|edinburgh|glasgow",
   "leeds|bristol|cardiff|sheffield|newcastle/newcastle upon tyne|oxford|cambridge|belfast|nottingham|leicester|brighton/brighton and hove|york|aberdeen|southampton|coventry|bath",
   "plymouth|portsmouth|norwich|exeter|canterbury|dundee|swansea|bradford|wolverhampton|derby|sunderland|stoke-on-trent/stoke|hull/kingston upon hull|inverness|stirling|chester|lincoln|durham|winchester|salisbury|gloucester|worcester|peterborough|milton keynes|preston|lancaster|carlisle|derry/londonderry|newport|salford|wakefield|st albans|chelmsford|colchester|southend-on-sea/southend",
   "ripon|lichfield|hereford|truro|chichester|newry|lisburn|bangor|wrexham|perth|dunfermline|doncaster",
   "st davids|st asaph|armagh|ely|wells|city of london"]
  ];

  var TIERS = [
    { name: 'Grounded', pts: 10, c: '#8D7B68', e: '🟫' },
    { name: 'Cloudline', pts: 25, c: '#5E8FC4', e: '🟨' },
    { name: 'Jet Stream', pts: 50, c: '#24966E', e: '🟩' },
    { name: 'Stratos', pts: 75, c: '#3F5FD8', e: '🟦' },
    { name: 'Thin Air', pts: 100, c: '#8A3FD6', e: '🟪' }
  ];
  var KM = 0.15, N = 7, SECS = 20, MAXKM = 120, SHOW = 10;
  var S = {
    kit: null, el: null, phase: 'intro', mode: 'daily', prompts: [], i: 0, results: [], thermalUsed: false, thermalOn: false,
    shownAt: 0, deadline: 0, raf: 0, ms: 0, last: null, prevKm: 0,
    me: null, board: null, scope: 'today', boardLoading: false, result: null, submitting: false, nameMsg: ''
  };

  // ------------------------------------------------------------------ helpers
  function X() { return window.UnizyWeb && window.UnizyWeb._internal; }
  function signedIn() { return !!(X() && X().Auth.session); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function prettyDay() {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); }
    catch (e) { return today(); }
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function fmt(ms) { var s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function km(pts) { return (pts || 0) * KM; }
  function kmTxt(pts) { return km(pts).toFixed(1); }
  function rpc(name, args) {
    return X().Sync.rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error((b && b.message) || 'Something went wrong.'); return b; });
    });
  }
  function startedToday() { try { return !!localStorage.getItem('unizy:thinair:' + today()); } catch (e) { return false; } }
  function total() { return S.results.reduce(function (a, r) { return a + r.pts; }, 0); }
  function answered() { return S.results.filter(function (r) { return r.tier >= 0; }).length; }
  function rare() { return S.results.filter(function (r) { return r.tier === 4; }).length; }
  function layerOf(k) { return k >= 100 ? 'Space' : k >= 85 ? 'Thermosphere' : k >= 50 ? 'Mesosphere' : k >= 12 ? 'Stratosphere' : 'Troposphere'; }
  function visible() { return S.el && document.body.contains(S.el) && S.el.offsetParent !== null; }

  // ------------------------------------------------------------------ answers
  function norm(s) {
    return String(s).toLowerCase().replace(/\+\+/g, 'plusplus').replace(/#/g, 'sharp').replace(/&/g, ' and ')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim()
      .replace(/^(the|a|an) /, '').replace(/ line$/, '').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ');
  }
  function title(s) {
    return s.replace(/(^|[\s\-(\/])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/(?!^)\b(And|Of|The|For|To|With|Upon|De|Du|Del|On)\b/g, function (w) { return w.toLowerCase(); })
      .replace(/^./, function (c) { return c.toUpperCase(); })
      .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii)\b/g, function (m) { return m.toUpperCase(); });
  }
  var CATS = BANK.map(function (row) {
    var map = new Map(), tiers = row.slice(1), lists = tiers.map(function () { return []; });
    tiers.forEach(function (t, ti) {
      t.split('|').filter(Boolean).forEach(function (entry) {
        var al = entry.split('/'), name = title(al[0]);
        lists[ti].push(name);
        al.forEach(function (a) { var k = norm(a); if (k && !map.has(k)) map.set(k, { name: name, tier: ti }); });
      });
    });
    return { q: row[0], map: map, lists: lists };
  });
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var p = []; for (var j = 0; j <= b.length; j++) p[j] = j;
    for (var i = 1; i <= a.length; i++) { var c = [i]; for (j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[b.length];
  }
  function lookup(cat, raw) {
    var s = norm(raw); if (!s) return null;
    var c = [s];
    if (/ies$/.test(s)) c.push(s.slice(0, -3) + 'y');
    if (/es$/.test(s)) c.push(s.slice(0, -2));
    if (/s$/.test(s)) c.push(s.slice(0, -1));
    c.push(s + 's');
    for (var i = 0; i < c.length; i++) if (cat.map.has(c[i])) return cat.map.get(c[i]);
    if (s.length < 4) return null;
    var best = null, bd = 9;
    cat.map.forEach(function (v, k) { if (k.length < 5) return; var lim = k.length >= 8 ? 2 : 1, d = lev(s, k); if (d <= lim && d < bd) { bd = d; best = v; } });
    return best;
  }
  function pickPrompts(rand) {
    var idx = CATS.map(function (_, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    return idx.slice(0, N);
  }

  // ------------------------------------------------------------------ the sky
  var STOPS = [[0, '#5FB0FF', '#D6ECFF'], [12, '#2F78D6', '#8FC6FF'], [50, '#183A91', '#3D6FD1'], [85, '#0A1240', '#1D2C70'], [100, '#03040E', '#0B1232'], [130, '#000003', '#05081C']];
  function hx(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function mix(a, b, t) { var A = hx(a), B = hx(b); return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')'; }
  function sky(k) {
    for (var i = 0; i < STOPS.length - 1; i++) {
      var s0 = STOPS[i], s1 = STOPS[i + 1];
      if (k <= s1[0]) { var t = Math.max(0, (k - s0[0]) / (s1[0] - s0[0])); return 'linear-gradient(to bottom,' + mix(s0[1], s1[1], t) + ',' + mix(s0[2], s1[2], t) + ')'; }
    }
    var l = STOPS[STOPS.length - 1]; return 'linear-gradient(to bottom,' + l[1] + ',' + l[2] + ')';
  }
  var STARS = (function () { var r = rng(7), h = ''; for (var i = 0; i < 110; i++) { var s = r() < 0.15 ? 3 : 2; h += '<i style="left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 100).toFixed(1) + '%;width:' + s + 'px;height:' + s + 'px;opacity:' + (0.4 + r() * 0.6).toFixed(2) + '"></i>'; } return h; })();
  var CLOUDS = (function () { var r = rng(11), h = ''; for (var i = 0; i < 8; i++) { var w = 80 + r() * 150; h += '<span style="width:' + w.toFixed(0) + 'px;height:' + (w * 0.32).toFixed(0) + 'px;left:' + (r() * 95 - 5).toFixed(1) + '%;top:' + (40 + r() * 55).toFixed(1) + '%;opacity:' + (0.55 + r() * 0.35).toFixed(2) + '"></span>'; } return h; })();
  var BALLOON = '<svg class="ta-balloon" data-ta-balloon viewBox="0 0 120 170" aria-hidden="true"><defs><clipPath id="ta-env"><path d="M60 4C28 4 6 28 6 58c0 28 22 50 38 66h32c16-16 38-38 38-66C114 28 92 4 60 4z"/></clipPath></defs><g clip-path="url(#ta-env)"><rect width="120" height="130" fill="#FF6B4A"/><rect x="22" width="16" height="130" fill="#FFE8C7"/><rect x="52" width="16" height="130" fill="#FFB347"/><rect x="82" width="16" height="130" fill="#FFE8C7"/><ellipse cx="40" cy="36" rx="14" ry="22" fill="#fff" opacity=".22"/></g><path d="M44 124 L50 142 M76 124 L70 142" stroke="#5A3B22" stroke-width="2"/><rect x="47" y="142" width="26" height="20" rx="4" fill="#8A5A32"/><rect x="47" y="142" width="26" height="5" rx="2" fill="#6B4224"/></svg>';
  function gauge() {
    return '<div class="ta-gauge" aria-hidden="true"><i class="ta-rail"></i>' + [[0, '0'], [12, '12'], [50, '50'], [85, '85'], [100, '100 · space']].map(function (t) {
      return '<span class="ta-tick" style="bottom:' + (t[0] / MAXKM * 100).toFixed(2) + '%">' + t[1] + '</span>';
    }).join('') + '<i class="ta-dot" data-ta-dot></i></div>';
  }
  function stage(inner, cls, k) {
    var f = Math.min(k, MAXKM) / MAXKM;
    return '<div class="ta-stage ' + (cls || '') + '" data-ta-stage style="background:' + sky(k) + '">' +
      '<div class="ta-stars" data-ta-stars style="opacity:' + Math.min(1, Math.max(0, (k - 35) / 55)).toFixed(2) + '">' + STARS + '</div>' +
      '<div class="ta-clouds" data-ta-clouds style="transform:translateY(' + (Math.min(k, 40) * 6).toFixed(0) + 'px);opacity:' + Math.max(0, 1 - k / 30).toFixed(2) + '">' + CLOUDS + '</div>' +
      BALLOON.replace('data-ta-balloon', 'data-ta-balloon style="bottom:calc(6% + ' + (f * 72).toFixed(1) + '%)"') + gauge().replace('data-ta-dot', 'data-ta-dot style="bottom:' + (f * 100).toFixed(1) + '%"') +
      '<div class="ta-hud"><span data-ta-step></span><span class="ta-alt"><b data-ta-alt>' + k.toFixed(1) + '</b><small>km</small><em data-ta-layer>' + layerOf(k) + '</em></span></div>' +
      '<div class="ta-inner" data-ta-panel>' + inner + '</div></div>';
  }
  function setAlt(k) {
    if (!S.el) return;
    var q = function (a) { return S.el.querySelector('[' + a + ']'); }, f = Math.min(k, MAXKM) / MAXKM;
    var st = q('data-ta-stage'); if (!st) return;
    st.style.background = sky(k);
    q('data-ta-stars').style.opacity = Math.min(1, Math.max(0, (k - 35) / 55));
    var cl = q('data-ta-clouds'); cl.style.transform = 'translateY(' + (Math.min(k, 40) * 6).toFixed(0) + 'px)'; cl.style.opacity = Math.max(0, 1 - k / 30);
    q('data-ta-balloon').style.bottom = 'calc(6% + ' + (f * 72).toFixed(1) + '%)';
    q('data-ta-dot').style.bottom = (f * 100).toFixed(1) + '%';
    q('data-ta-alt').textContent = k.toFixed(1);
    q('data-ta-layer').textContent = layerOf(k);
  }

  // ------------------------------------------------------------------ leaderboard
  function loadMe() {
    if (!signedIn()) { S.me = { signed_in: false }; draw(); return; }
    rpc('thinair_me', {}).then(function (m) { S.me = m; draw(); }).catch(function () { S.me = { signed_in: true, failed: true }; draw(); });
  }
  function loadBoard(scope) {
    if (scope) S.scope = scope;
    if (!signedIn()) { S.board = null; draw(); return; }
    S.boardLoading = true; draw();
    rpc('thinair_board', { p_scope: S.scope, p_uni: S.kit && S.kit.uniId }).then(function (b) { S.board = b; S.boardLoading = false; draw(); })
      .catch(function () { S.boardLoading = false; S.board = { failed: true }; draw(); });
  }
  function submitArgs() {
    var k = S.kit || {};
    return { p_score: total(), p_answered: answered(), p_rare: rare(), p_ms: Math.max(2000, Math.round(S.ms)), p_uni: k.uniId || '', p_name: (S.me && S.me.name) || null };
  }
  function submit() {
    if (!signedIn() || S.mode !== 'daily') return;
    S.submitting = true; draw();
    rpc('thinair_submit', submitArgs()).then(function (r) { S.submitting = false; S.result = r; if (r && r.me) S.me = r.me; loadBoard('today'); })
      .catch(function () { S.submitting = false; S.result = { failed: true }; draw(); });
  }
  window.addEventListener('pagehide', function () {
    if ((S.phase !== 'play' && S.phase !== 'reveal') || S.mode !== 'daily' || !signedIn() || !S.results.length) return;
    try { var CFG = window.UNIZY_CONFIG || {}; fetch(CFG.supabaseUrl + '/rest/v1/rpc/thinair_submit', { method: 'POST', keepalive: true, headers: X().Auth.headers(true), body: JSON.stringify(submitArgs()) }); } catch (e) { /* ignore */ }
  });

  // ------------------------------------------------------------------ the run
  function stopTimer() { if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } }
  function tick() {
    if (S.phase !== 'play') { S.raf = 0; return; }
    var left = Math.max(0, S.deadline - Date.now());
    var bar = S.el && S.el.querySelector('[data-ta-bar]');
    if (bar) {
      bar.style.width = (left / (SECS * 1000) * 100).toFixed(2) + '%';
      bar.parentNode.classList.toggle('low', left <= 5000);
      var n = S.el.querySelector('[data-ta-secs]'), secs = String(Math.ceil(left / 1000)); if (n && n.textContent !== secs) n.textContent = secs;
    }
    if (left <= 0) { var inp = S.el && S.el.querySelector('[data-ta-input]'); answer(inp ? inp.value : '', true); return; }
    S.raf = requestAnimationFrame(tick);
  }
  function start(mode) {
    if (mode === 'daily' && signedIn() && (startedToday() || (S.me && S.me.played))) mode = 'free';
    S.mode = mode;
    if (mode === 'daily' && signedIn()) { try { localStorage.setItem('unizy:thinair:' + today(), String(Date.now())); } catch (e) { /* ignore */ } }
    S.prompts = pickPrompts(mode === 'daily' ? rng(hash('thinair|' + today())) : Math.random);
    S.i = 0; S.results = []; S.thermalUsed = false; S.ms = 0; S.result = null; S.prevKm = 0;
    S.el.innerHTML = '<div class="ta-run">' + stage('', 'run', 0) + '<p class="pl-keys">Type an answer and press Enter. Not on the list? Try another until the timer runs out.' + (mode === 'free' ? ' Free climb: not counted on the leaderboard.' : '') + '</p></div>';
    var q = S.el.querySelector('[data-ta-stage]'); if (q) q.insertAdjacentHTML('afterbegin', '<button type="button" class="pl-x ta-x" data-ta-quit aria-label="Stop">×</button>');
    nextPrompt();
    try { if (S.el.getBoundingClientRect().top < 0) S.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
  }
  function panel(html) { var p = S.el && S.el.querySelector('[data-ta-panel]'); if (p) p.innerHTML = html; var s = S.el && S.el.querySelector('[data-ta-step]'); if (s) s.textContent = 'Prompt ' + Math.min(S.i + 1, N) + ' of ' + N + (S.mode === 'free' ? ' · free climb' : ''); }
  function nextPrompt() {
    if (S.i >= N) return finish();
    S.phase = 'play'; S.thermalOn = false;
    var cat = CATS[S.prompts[S.i]];
    panel('<div class="ta-card"><span class="pl-kick">Prompt ' + (S.i + 1) + ' of ' + N + '</span><h3>' + esc(cat.q) + '</h3>' +
      '<div class="ta-timer"><i data-ta-bar></i><span data-ta-secs>' + SECS + '</span></div>' +
      '<form class="ta-form" data-ta-form><input data-ta-input maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type an answer…" aria-label="Your answer"><button type="submit" class="pl-btn">Go</button></form>' +
      '<p class="ta-msg" data-ta-msg hidden></p>' +
      '<div class="ta-row"><button type="button" class="ta-thermal" data-ta-thermal' + (S.thermalUsed ? ' disabled' : '') + '>🔥 Thermal ×2 ' + (S.thermalUsed ? '(used)' : '(1 left)') + '</button><button type="button" class="pl-link ta-skip" data-ta-skip>Skip →</button></div></div>');
    S.shownAt = Date.now(); S.deadline = S.shownAt + SECS * 1000;
    focusInput(); stopTimer(); S.raf = requestAnimationFrame(tick);
  }
  function focusInput() { setTimeout(function () { var g = S.el && S.el.querySelector('[data-ta-input]'); if (g) try { g.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30); }
  function answer(raw, timedOut) {
    if (S.phase !== 'play') return;
    raw = String(raw || '').trim();
    var cat = CATS[S.prompts[S.i]], m = raw ? lookup(cat, raw) : null;
    if (!m && raw && !timedOut) {
      var msg = S.el.querySelector('[data-ta-msg]'), inp = S.el.querySelector('[data-ta-input]');
      msg.innerHTML = '“' + esc(raw) + '” isn’t on our list. Try another!'; msg.hidden = false;
      inp.value = ''; inp.classList.remove('ta-shake'); void inp.offsetWidth; inp.classList.add('ta-shake'); inp.focus();
      return;
    }
    stopTimer(); S.phase = 'reveal';
    S.ms += Math.min(Date.now() - S.shownAt, SECS * 1000);
    var thermal = !!(S.thermalOn && m); if (thermal) S.thermalUsed = true;
    var pts = m ? TIERS[m.tier].pts * (thermal ? 2 : 1) : 0;
    S.results.push({ q: cat.q, ci: S.prompts[S.i], input: raw, name: m ? m.name : null, tier: m ? m.tier : -1, pts: pts, thermal: thermal });
    setAlt(km(total()));
    var above = [], from = m ? m.tier + 1 : 2;
    for (var t = 4; t >= from; t--) above = above.concat(cat.lists[t]);
    above = above.filter(function (n) { return !m || n !== m.name; }).sort(function () { return Math.random() - 0.5; }).slice(0, 4);
    var T = m ? TIERS[m.tier] : null, head;
    if (m) head = '<div class="ta-res" style="background:' + T.c + '"><b>' + T.name + (thermal ? ' · 🔥 doubled' : '') + '</b><strong>+' + pts + ' pts · +' + kmTxt(pts) + ' km</strong><span>' + esc(m.name) + (norm(raw) !== norm(m.name) ? ' <i>(you typed “' + esc(raw) + '”)</i>' : '') + '</span></div>';
    else head = '<div class="ta-res miss"><b>' + (timedOut ? 'Out of time' : 'Skipped') + '</b><strong>+0 pts</strong>' + (raw ? '<span>“' + esc(raw) + '” didn’t match before the timer ran out.</span>' : '') + (S.thermalOn ? '<span>Your Thermal wasn’t used. It’s still yours.</span>' : '') + '</div>';
    var last = S.i + 1 >= N;
    panel('<div class="ta-card"><span class="pl-kick">Prompt ' + (S.i + 1) + ' of ' + N + '</span><h3>' + esc(cat.q) + '</h3>' + head +
      (above.length ? '<span class="ta-lab">' + (m && m.tier === 4 ? 'Others up here' : 'Could have climbed higher with') + '</span><div class="ta-chips">' + above.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</div>' : '') +
      '<span class="ta-lab">What most people say</span><div class="ta-chips">' + cat.lists[0].slice(0, 4).map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</div>' +
      '<button type="button" class="pl-btn" data-ta-next>' + (last ? 'See your altitude →' : 'Next prompt →') + '</button></div>');
    setTimeout(function () { var b = S.el && S.el.querySelector('[data-ta-next]'); if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }
  function next() { if (S.phase !== 'reveal') return; S.i++; nextPrompt(); }
  function finish() {
    stopTimer(); S.phase = 'done';
    draw();
    if (S.mode === 'daily') submit();
  }

  // ------------------------------------------------------------------ screens
  function boardHtml() {
    if (!signedIn()) return '<p class="pl-note">Log in to see the leaderboard and put your altitude on it. <a href="/login?next=%2Fdashboard%2Fplay%3Fg%3Dthinair">Log in</a> · <a href="/signup?next=%2Fdashboard%2Fplay%3Fg%3Dthinair">Sign up free</a></p>';
    var tabs = [['today', 'Today'], ['week', 'This week'], ['uni', (S.kit && S.kit.uniShort ? S.kit.uniShort : 'My uni') + ' today']].map(function (t) {
      return '<button type="button" class="pl-tab' + (S.scope === t[0] ? ' on' : '') + '" data-ta-scope="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('');
    var b = S.board, rows;
    if (S.boardLoading && !b) rows = '<p class="pl-note">Loading…</p>';
    else if (!b || b.failed) rows = '<p class="pl-note">Couldn’t load the leaderboard. <button type="button" class="pl-link" data-ta-scope="' + S.scope + '">Try again</button></p>';
    else if (!b.rows || !b.rows.length) rows = '<p class="pl-note">No climbs yet ' + (S.scope === 'week' ? 'this week' : 'today') + '. Be the first.</p>';
    else {
      rows = '<ol class="pl-board">' + b.rows.map(function (r) {
        var detail = S.scope === 'week' ? r.days + (r.days === 1 ? ' day' : ' days') : r.answered + '/' + N + ' answered' + (r.rare ? ' · ' + r.rare + ' in Thin Air' : '');
        return '<li class="' + (r.me ? 'me' : '') + '"><span class="rk">' + r.rank + '</span><span class="nm"><b>' + esc(r.name || 'A student') + (r.me ? ' (you)' : '') + '</b><small>' + esc(String(r.uni || '').toUpperCase()) + ' · ' + detail + ' · ' + fmt(r.ms) + '</small></span><span class="sc">' + kmTxt(r.score) + '<small> km</small></span></li>';
      }).join('') + '</ol>';
      rows += b.mine && b.mine.rank > 25 ? '<p class="pl-note">You’re #' + b.mine.rank + ' of ' + b.players + '.</p>' : '<p class="pl-note">' + b.players + (b.players === 1 ? ' climber' : ' climbers') + (S.scope === 'week' ? ' this week' : ' today') + ' · highest altitude first, then fastest.</p>';
    }
    return '<div class="pl-tabs">' + tabs + '</div>' + rows;
  }
  function nameHtml() {
    if (!signedIn() || !S.me || !S.me.signed_in) return '';
    var k = S.kit || {};
    return '<div class="pl-name"><label for="ta-name">Your name on the board</label><div><input id="ta-name" data-ta-name maxlength="24" value="' + esc(S.me.name || '') + '" placeholder="' + esc((k.uniShort || 'A') + ' student') + '"><button type="button" class="pl-btn small ghost" data-ta-rename>Save</button></div><small>' + esc(S.nameMsg || 'Letters, numbers, spaces and . _ - only. Everyone signed up can see it.') + '</small></div>';
  }
  function boardCard(cls) { return '<section class="pl-card ' + (cls || '') + '"><div class="pl-h"><span class="pl-kick">Leaderboard</span><h3>Highest climbs</h3></div>' + boardHtml() + nameHtml() + '</section>'; }
  function tiersHtml() { return '<div class="ta-tiers">' + TIERS.map(function (t) { return '<span style="background:' + t.c + '">' + t.name + '<b>+' + t.pts + '</b></span>'; }).join('') + '</div>'; }
  function introHtml() {
    var me = S.me || {}, cta;
    if (me.played) cta = '<div class="uw-today">Today: <b>' + kmTxt(me.score) + ' km</b> (' + me.answered + '/' + N + ' answered' + (me.rare ? ', ' + me.rare + ' in Thin Air' : '') + '). New prompts tomorrow.</div><button type="button" class="pl-btn ghost" data-ta-start="free">Free climb</button>';
    else if (signedIn() && startedToday()) cta = '<div class="uw-today">You’ve already started today’s climb on this device. New prompts tomorrow.</div><button type="button" class="pl-btn ghost" data-ta-start="free">Free climb</button>';
    else cta = '<button type="button" class="pl-btn" data-ta-start="daily">Start today’s climb</button><button type="button" class="pl-btn ghost" data-ta-start="free">Free climb</button>' + (signedIn() ? '' : '<p class="pl-note">Not logged in, so your altitude won’t go on the leaderboard. <a href="/login?next=%2Fdashboard%2Fplay%3Fg%3Dthinair">Log in</a></p>');
    var stats = signedIn() && me.signed_in && !me.failed ? '<div class="pl-stats"><div><b>' + (me.streak || 0) + '</b><span>day streak</span></div><div><b>' + (me.best != null ? kmTxt(me.best) : '–') + '</b><span>best km</span></div><div><b>' + (me.games || 0) + '</b><span>climbs</span></div></div>' : '';
    return '<div class="pl-grid"><section class="pl-card ta-hero"><div class="ta-hero-txt"><span class="pl-kick">' + esc(prettyDay()) + '</span><h2>Say what nobody else will.<br><em>Rare answers climb higher.</em></h2>' +
      '<p class="uw-lede">Seven prompts, 20 seconds each. Any answer we accept counts, but the obvious ones keep you near the ground. Not on our list? Keep trying until the timer runs out. Every point lifts your balloon 150 m, and a perfect run breaks the 100 km line into space. You get one <b>🔥 Thermal</b> per climb to double a single answer.</p>' +
      tiersHtml() + stats + '<div class="pl-cta">' + cta + '</div></div>' +
      '<div class="ta-mini" aria-hidden="true">' + stage('', 'mini', 38) + '</div></section>' + boardCard('ta-wide') + '</div>';
  }
  function chipsFor(list, you) { return list.map(function (n) { return '<span class="' + (n === you ? 'you' : '') + '">' + (n === you ? '✓ ' : '') + esc(n) + '</span>'; }).join(''); }
  function overview() {
    return S.results.map(function (r, i) {
      var cat = CATS[r.ci];
      var tiers = [4, 3, 2, 1, 0].map(function (t) {
        var L = cat.lists[t]; if (!L.length) return '';
        var show = L.slice(0, SHOW);
        if (r.name && r.tier === t && show.indexOf(r.name) < 0) show = [r.name].concat(show.slice(0, SHOW - 1));
        var more = L.length - show.length;
        return '<div class="ta-ovt"><span class="ta-pill" style="background:' + TIERS[t].c + '">' + TIERS[t].name + ' · +' + TIERS[t].pts + '</span><div class="ta-chips">' + chipsFor(show, r.name) + (more > 0 ? '<button type="button" class="ta-more" data-ta-more="' + i + ':' + t + '">+' + more + ' more</button>' : '') + '</div></div>';
      }).join('');
      var sub = r.name ? esc(r.name) : r.input ? '“' + esc(r.input) + '” · out of time' : 'no answer';
      var pill = '<span class="ta-pill" style="background:' + (r.tier < 0 ? '#3A4556' : TIERS[r.tier].c) + '">' + (r.tier < 0 ? 'Miss' : TIERS[r.tier].name) + ' +' + r.pts + '</span>';
      return '<details class="ta-ov"><summary><span class="q">' + esc(r.q) + '<small>' + sub + '</small></span>' + (r.thermal ? '🔥' : '') + pill + '<i class="chev">▸</i></summary><div class="ta-ovb">' + tiers + '</div></details>';
    }).join('');
  }
  function grid() { return S.results.map(function (r) { return (r.tier < 0 ? '⬛' : TIERS[r.tier].e) + (r.thermal ? '🔥' : ''); }).join(''); }
  function doneHtml() {
    var pts = total(), k = km(pts), res = '';
    var line = k >= 100 ? 'You slipped past the Kármán line. That’s space.' : k >= 85 ? 'Brushing the edge of space.' : k >= 50 ? 'Up where meteors burn.' : k >= 12 ? 'Above the weather, in the stratosphere.' : 'Still in the clouds. Tomorrow’s another climb.';
    if (S.mode === 'daily') {
      if (!signedIn()) res = '<p class="pl-note">Log in to put your altitude on the leaderboard and keep a streak. <a href="/login?next=%2Fdashboard%2Fplay%3Fg%3Dthinair">Log in</a> · <a href="/signup?next=%2Fdashboard%2Fplay%3Fg%3Dthinair">Sign up free</a></p>';
      else if (S.submitting) res = '<p class="pl-note">Adding your climb to the board…</p>';
      else if (S.result && S.result.failed) res = '<p class="pl-note">Couldn’t save your climb. <button type="button" class="pl-link" data-ta-resubmit>Try again</button></p>';
      else if (S.result && S.result.counted === false) res = '<p class="pl-note">You’d already climbed today, so this one didn’t count.</p>';
      else if (S.result) { var mine = S.board && S.board.mine; res = '<div class="pl-rank">' + (mine ? '<b>#' + mine.rank + '</b> of ' + S.board.players + ' today' : 'On the board') + ' · ' + ((S.me && S.me.streak) || 1) + '-day streak</div>'; }
    } else res = '<p class="pl-note">Free climb: not counted on the leaderboard.</p>';
    var inner = '<div class="ta-card ta-endcard"><span class="pl-kick">' + (S.mode === 'daily' ? 'Today’s climb' : 'Free climb') + '</span><h2>' + k.toFixed(1) + '<small> km</small></h2><p class="uw-lede"><b>' + layerOf(k) + '.</b> ' + line + ' ' + pts + ' points from ' + answered() + '/' + N + ' answers.</p><div class="ta-grid">' + grid() + '</div>' + res +
      '<div class="pl-cta"><button type="button" class="pl-btn" data-ta-share>Copy my result</button><button type="button" class="pl-btn ghost" data-ta-start="free">Free climb</button><button type="button" class="pl-btn ghost" data-ta-home>Done</button></div></div>';
    return '<div class="pl-grid"><section class="ta-endstage">' + stage(inner, 'end', S.prevKm) + '</section>' +
      '<section class="pl-card ta-overview"><div class="pl-h"><span class="pl-kick">Overview</span><h3>What would have flown higher</h3></div><p class="pl-note">Tap a prompt to see every answer we accept, from the rarest down to the most common. <button type="button" class="pl-link" data-ta-expand>Expand all</button></p><div class="ta-ovs">' + overview() + '</div></section>' + boardCard() + '</div>';
  }
  function draw() {
    var el = S.el; if (!el || !document.body.contains(el)) return;
    if (S.phase === 'play' || S.phase === 'reveal') {
      // keep the running stage in place; just refresh the board name/rank bits if they ever render here
      if (!el.querySelector('[data-ta-stage]')) { var keep = S.phase; S.phase = 'intro'; el.innerHTML = introHtml(); S.phase = keep; }
      return;
    }
    if (S.phase === 'done') {
      var openSet = {}; el.querySelectorAll('details.ta-ov').forEach(function (d, i) { if (d.open) openSet[i] = 1; });
      el.innerHTML = doneHtml();
      el.querySelectorAll('details.ta-ov').forEach(function (d, i) { if (openSet[i]) d.open = true; });
      var target = km(total());
      if (S.prevKm !== target) { setTimeout(function () { setAlt(target); S.prevKm = target; }, 60); }
      return;
    }
    el.innerHTML = introHtml();
  }

  // ------------------------------------------------------------------ events
  function onClick(e) {
    var t = e.target.closest && e.target.closest('[data-ta-start],[data-ta-next],[data-ta-skip],[data-ta-thermal],[data-ta-scope],[data-ta-quit],[data-ta-home],[data-ta-share],[data-ta-rename],[data-ta-resubmit],[data-ta-more],[data-ta-expand]');
    if (!t || !S.el || !S.el.contains(t)) return;
    if (t.hasAttribute('data-ta-start')) start(t.getAttribute('data-ta-start'));
    else if (t.hasAttribute('data-ta-next')) next();
    else if (t.hasAttribute('data-ta-skip')) answer('', false);
    else if (t.hasAttribute('data-ta-thermal')) { if (S.thermalUsed) return; S.thermalOn = !S.thermalOn; t.classList.toggle('on', S.thermalOn); focusInput(); }
    else if (t.hasAttribute('data-ta-scope')) loadBoard(t.getAttribute('data-ta-scope'));
    else if (t.hasAttribute('data-ta-resubmit')) submit();
    else if (t.hasAttribute('data-ta-home')) { stopTimer(); S.phase = 'intro'; draw(); }
    else if (t.hasAttribute('data-ta-quit')) {
      if (S.mode === 'daily' && !confirm('Stop today’s climb? What you’ve answered so far is what counts.')) return;
      if (S.phase === 'play') S.ms += Math.min(Date.now() - S.shownAt, SECS * 1000);
      finish();
    }
    else if (t.hasAttribute('data-ta-more')) {
      var p = t.getAttribute('data-ta-more').split(':'), r = S.results[+p[0]];
      t.parentNode.innerHTML = chipsFor(CATS[r.ci].lists[+p[1]], r.name);
    }
    else if (t.hasAttribute('data-ta-expand')) {
      var all = [].slice.call(S.el.querySelectorAll('details.ta-ov')), open = !all.every(function (d) { return d.open; });
      all.forEach(function (d) { d.open = open; }); t.textContent = open ? 'Collapse all' : 'Expand all';
    }
    else if (t.hasAttribute('data-ta-rename')) {
      var v = (document.querySelector('[data-ta-name]') || {}).value || '';
      if (!v.trim()) { S.nameMsg = 'Type a name first.'; draw(); return; }
      if (!(S.me && S.me.games)) { S.me = Object.assign({}, S.me, { name: v.trim().slice(0, 24) }); S.nameMsg = 'Saved. It’ll show when you climb today.'; draw(); return; }
      rpc('thinair_rename', { p_name: v }).then(function (r) { S.me = Object.assign({}, S.me, { name: r.name }); S.nameMsg = 'Saved.'; loadBoard(); }).catch(function () { S.nameMsg = 'Couldn’t save that name. Use letters and numbers.'; draw(); });
    }
    else if (t.hasAttribute('data-ta-share')) {
      var txt = 'Unizy Thin Air · ' + prettyDay() + '\n' + kmTxt(total()) + ' km · ' + layerOf(km(total())) + '\n' + grid() + '\nunizy.uk/dashboard/play';
      var done = function () { t.textContent = 'Copied ✓'; setTimeout(function () { t.textContent = 'Copy my result'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { prompt('Copy your result:', txt); });
      else prompt('Copy your result:', txt);
    }
  }
  function onSubmit(e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-ta-form')) { e.preventDefault(); var i = e.target.querySelector('[data-ta-input]'); answer(i ? i.value : '', false); } }
  function onKey(e) {
    if (S.phase !== 'reveal' || !visible()) return;
    if (e.key === 'Enter' && !(e.target && /INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY/.test(e.target.tagName))) { e.preventDefault(); next(); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKey);

  window.UnizyThinAir = {
    mount: function (kit) {
      if (kit) S.kit = kit;
      var el = document.getElementById('uz-thinair');
      if (!el) { S.el = null; return; }
      if (el !== S.el || !el.firstChild) {
        S.el = el;
        if (!S.me) loadMe();
        if (!S.board && !S.boardLoading) loadBoard();
        draw();
      }
    }
  };
})();
