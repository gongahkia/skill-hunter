import random
from collections import deque

def generate_tournament_bracket(tracks):
    random.shuffle(tracks)
    bracket = []
    queue = deque(tracks)
    
    while len(queue) >= 2:
        match = {
            'match_id': len(bracket)+1,
            'track1': queue.popleft(),
            'track2': queue.popleft(),
            'winner': None
        }
        bracket.append(match)
    
    return bracket