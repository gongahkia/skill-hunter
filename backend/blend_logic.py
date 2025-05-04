def create_multi_blend(user_data, filters):
    from collections import defaultdict
    
    # 1. Aggregate tracks with weights
    track_contributions = defaultdict(list)
    for user in user_data:
        for track, weight in zip(user['tracks'], user['weights']):
            track_contributions[track].append({
                'user': user['user'],
                'weight': weight
            })
    
    # 2. Apply filters
    filtered_tracks = apply_audio_filters(track_contributions.keys(), filters)
    
    # 3. Calculate percentages
    blended = []
    for track_id in filtered_tracks:
        total = sum(c['weight'] for c in track_contributions[track_id])
        contributors = {
            c['user']: round((c['weight']/total)*100, 1)
            for c in track_contributions[track_id]
        }
        blended.append({
            'track_id': track_id,
            'contributors': contributors
        })
    
    return blended

def apply_audio_filters(track_ids, filters):
    # Implement audio feature filtering using Spotify's audio-features endpoint
    # Returns filtered list of track IDs
    return track_ids  # Simplified for example