"""Unwind's hidden words: everyday words of 6-10 letters with a gentle theme hint. Builds site/data/play/words.json."""
import json, pathlib, random
W = [
  # 6 letters
  ("GARDEN", "Outdoors at home"), ("PLANET", "Up in the sky"), ("PENCIL", "On your desk"), ("ORANGE", "A fruit, and a colour"),
  ("CASTLE", "Kings and queens lived here"), ("SUMMER", "A season"), ("BRIDGE", "You cross it"), ("WINTER", "A season"),
  ("TOMATO", "Red, and often argued about: fruit or veg?"), ("RABBIT", "A pet with long ears"), ("GUITAR", "A musical instrument"),
  ("ISLAND", "Surrounded by water"), ("COFFEE", "A morning drink"), ("SCHOOL", "Where lessons happen"), ("JUNGLE", "A wild place"),
  ("POCKET", "On your clothes"), ("SPRING", "A season"), ("LIBRARY", "Full of books"), ("TICKET", "You need one to get in"),
  ("CAMERA", "Takes pictures"), ("BUTTER", "On your toast"), ("KITTEN", "A young animal"), ("ROCKET", "Heads into space"),
  ("CANDLE", "Gives a soft light"), ("PICNIC", "Food outdoors"), ("MARKET", "Where you buy things"), ("VALLEY", "Between hills"),
  ("TURTLE", "A slow animal with a shell"), ("PILLOW", "In your bed"), ("WINDOW", "Look through it"),
  # 7 letters
  ("RAINBOW", "After the rain"), ("PENGUIN", "A bird that can't fly"), ("BICYCLE", "Two wheels"), ("DOLPHIN", "Lives in the sea"),
  ("BLANKET", "Keeps you warm"), ("PANCAKE", "Flipped in the kitchen"), ("JOURNEY", "Getting from A to B"), ("HOLIDAY", "Time off"),
  ("KITCHEN", "A room at home"), ("THUNDER", "Weather you can hear"), ("BLOSSOM", "On trees in spring"), ("TEACHER", "A job"),
  ("CHICKEN", "A farm animal"), ("BALLOON", "Floats at parties"), ("CRYSTAL", "Shiny and clear"), ("PYRAMID", "A shape, and a wonder"),
  ("LANTERN", "Carries a light"), ("MORNING", "Time of day"), ("BIRTHDAY", "Once a year"), ("GIRAFFE", "A very tall animal"),
  ("HARVEST", "On the farm in autumn"), ("SUNRISE", "Early in the day"), ("VOLCANO", "A mountain with a secret"), ("WEEKEND", "Saturday and Sunday"),
  ("POSTCARD", "Sent from holiday"), ("CUPCAKE", "A small sweet treat"), ("COMPASS", "Helps you find your way"), ("TRUMPET", "A musical instrument"),
  # 8 letters
  ("SUNSHINE", "Good weather"), ("ELEPHANT", "A very big animal"), ("MOUNTAIN", "Very high ground"), ("SANDWICH", "A lunchtime favourite"),
  ("DINOSAUR", "Lived long ago"), ("UMBRELLA", "For a rainy day"), ("TREASURE", "Pirates look for it"), ("MUSHROOM", "Grows in the woods"),
  ("BUTTERFLY", "Has colourful wings"), ("FOOTBALL", "A sport"), ("HOMEWORK", "After lessons"), ("SNOWBALL", "Winter fun"),
  ("FESTIVAL", "A big celebration"), ("TOMORROW", "The day after today"), ("KEYBOARD", "You type on it"), ("SKELETON", "Inside your body"),
  ("PAINTING", "Art on a wall"), ("CHAMPION", "The winner"), ("PINEAPPLE", "A tropical fruit"), ("STARFISH", "Lives on the seabed"),
  ("MARATHON", "A long race"), ("DAYDREAM", "A wander of the mind"), ("NOTEBOOK", "For writing in"), ("MOONLIGHT", "Night-time glow"),
  # 9 letters
  ("CHOCOLATE", "A sweet treat"), ("ADVENTURE", "An exciting journey"), ("BREAKFAST", "First meal of the day"), ("STRAWBERRY", "A red fruit"),
  ("WATERFALL", "Water on the move"), ("SNOWFLAKE", "Falls in winter"), ("KANGAROO", "Hops around Australia"), ("TELESCOPE", "For looking at stars"),
  ("CROCODILE", "Has lots of teeth"), ("HONEYCOMB", "Made by bees"), ("LIGHTNING", "A flash in the sky"), ("UNIVERSITY", "Where you study"),
  ("FIREWORKS", "Bonfire Night"), ("SUNFLOWER", "A very tall flower"), ("GRANDPARENT", "Family"), ("LIGHTHOUSE", "By the sea"),
  ("CAMPFIRE", "Outdoors at night"), ("SPAGHETTI", "A kind of pasta"), ("NEWSPAPER", "Read every day"), ("BLUEBERRY", "A small fruit"),
  # 10 letters
  ("WATERMELON", "A big juicy fruit"), ("BASKETBALL", "A sport"), ("RHINOCEROS", "Has a horn"), ("HELICOPTER", "Flies without wings"),
  ("STRAWBERRY", "A red fruit"), ("FRIENDSHIP", "People you like"), ("TRAMPOLINE", "Bounce on it"), ("SKATEBOARD", "Four wheels and a deck"),
  ("SANDCASTLE", "Built on the beach"), ("THUNDERBOLT", "Stormy"), ("BLACKBOARD", "In old classrooms"), ("PHOTOGRAPH", "A picture"),
  ("CHRISTMAS", "A winter holiday"), ("MOTORCYCLE", "Two wheels and an engine"), ("GINGERBREAD", "A biscuit"), ("PLAYGROUND", "Where children play"),
]
out, seen = [], set()
for w, h in W:
    w = w.upper()
    if not w.isalpha() or not 6 <= len(w) <= 10 or w in seen:
        continue
    seen.add(w)
    out.append({"w": w, "hint": h})
random.Random(20261102).shuffle(out)
dest = pathlib.Path(__file__).parent.parent.parent / 'site' / 'data' / 'play' / 'words.json'
dest.write_text(json.dumps(out, separators=(',', ':')))
from collections import Counter
print(len(out), 'words', dict(sorted(Counter(len(x['w']) for x in out).items())))
