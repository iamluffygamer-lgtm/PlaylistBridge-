/**
 * PlaylistBridge — netlify/functions/seed-vibes.js
 * ONE-TIME seeder. Call once to populate Firestore 'vibes' collection.
 * After seeding, you can delete or disable this function.
 *
 * Usage: GET https://playlistbridge.netlify.app/.netlify/functions/seed-vibes?key=pb-seed-2026
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore }           = require('firebase-admin/firestore');
const { credential }             = require('firebase-admin');

const VIBES = [
    {
        id: 'late-night-drive',
        vibe: 'late-night-drive',
        label: 'Late Night Drive',
        emoji: '🌙',
        tags: ['chill', 'night'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Midnight City - M83', 'The Less I Know The Better - Tame Impala', 'Electric Feel - MGMT', 'Video Games - Lana Del Rey', 'Do I Wanna Know - Arctic Monkeys', 'Redbone - Childish Gambino', 'Motion Picture Soundtrack - Radiohead', 'Night Drive - Jimmy Eat World', 'Lost In The Light - Bahamas', 'Cars - Gary Numan']
    },
    {
        id: 'morning-energy',
        vibe: 'morning-energy',
        label: 'Morning Energy',
        emoji: '☀️',
        tags: ['hype', 'focus'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Levitating - Dua Lipa', 'Can\'t Stop The Feeling - Justin Timberlake', 'Happy - Pharrell Williams', 'Good as Hell - Lizzo', 'Shake It Off - Taylor Swift', 'Uptown Funk - Bruno Mars', 'Walking On Sunshine - Katrina and The Waves', 'Best Day Of My Life - American Authors', 'Roar - Katy Perry', 'On Top Of The World - Imagine Dragons']
    },
    {
        id: 'heartbreak',
        vibe: 'heartbreak',
        label: 'Heartbreak',
        emoji: '💔',
        tags: ['sad', 'emotional'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Someone Like You - Adele', 'The Night Will Always Win - Manchester Orchestra', 'Skinny Love - Bon Iver', 'Stay With Me - Sam Smith', 'All I Want - Kodaline', 'When The Party\'s Over - Billie Eilish', 'Fix You - Coldplay', 'Back To Black - Amy Winehouse', 'Liability - Lorde', 'Happier - Ed Sheeran']
    },
    {
        id: 'focus-mode',
        vibe: 'focus-mode',
        label: 'Focus Mode',
        emoji: '🎯',
        tags: ['focus', 'lofi'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Experience - Ludovico Einaudi', 'Comptine d\'un autre été - Yann Tiersen', 'Divenire - Ludovico Einaudi', 'Time - Hans Zimmer', 'Strobe - Deadmau5', 'An Ending Ascent - Brian Eno', 'Svefn-g-englar - Sigur Ros', 'Intro - The xx', 'Holocene - Bon Iver', 'Re: Stacks - Bon Iver']
    },
    {
        id: 'hype-train',
        vibe: 'hype-train',
        label: 'Hype Train',
        emoji: '🔥',
        tags: ['hype', 'workout'],
        plays: 0,
        platform: 'yt_music',
        songs: ['SICKO MODE - Travis Scott', 'God\'s Plan - Drake', 'Blinding Lights - The Weeknd', 'Rockstar - DaBaby', 'Humble - Kendrick Lamar', 'Power - Kanye West', 'Black Skinhead - Kanye West', 'Berzerk - Eminem', 'Till I Collapse - Eminem', 'Lose Yourself - Eminem']
    },
    {
        id: 'sunday-chill',
        vibe: 'sunday-chill',
        label: 'Sunday Chill',
        emoji: '☕',
        tags: ['chill', 'relax'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Sunset Lover - Petit Biscuit', 'Bloom - The Paper Kites', 'Such Great Heights - The Postal Service', 'Yellow - Coldplay', 'Banana Pancakes - Jack Johnson', 'Better Together - Jack Johnson', 'Bubbly - Colbie Caillat', 'Sunday Morning - Maroon 5', 'Here Comes The Sun - The Beatles', 'Fast Car - Tracy Chapman']
    },
    {
        id: 'throwback-90s',
        vibe: 'throwback-90s',
        label: '90s Throwback',
        emoji: '📼',
        tags: ['90s', 'nostalgia'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Smells Like Teen Spirit - Nirvana', 'Wonderwall - Oasis', 'Waterfalls - TLC', 'No Scrubs - TLC', 'Baby One More Time - Britney Spears', 'Losing My Religion - R.E.M.', 'Under The Bridge - Red Hot Chili Peppers', 'Come As You Are - Nirvana', 'Everybody Hurts - R.E.M.', 'Creep - Radiohead']
    },
    {
        id: 'indie-feels',
        vibe: 'indie-feels',
        label: 'Indie Feels',
        emoji: '🎸',
        tags: ['indie', 'alt'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Ribs - Lorde', 'Stubborn Love - The Lumineers', 'Ho Hey - The Lumineers', 'Home - Edward Sharpe', 'Dog Days Are Over - Florence and The Machine', 'I Will Follow You Into The Dark - Death Cab For Cutie', 'Such Great Heights - The Postal Service', 'Lua - Bright Eyes', 'Brand New Colony - The Postal Service', 'Skinny Love - Bon Iver']
    },
    {
        id: 'workout-beast',
        vibe: 'workout-beast',
        label: 'Workout Beast',
        emoji: '💪',
        tags: ['workout', 'hype'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Eye of the Tiger - Survivor', 'Stronger - Kanye West', 'Till I Collapse - Eminem', 'Thunderstruck - AC/DC', 'We Will Rock You - Queen', 'Jump - Van Halen', 'Lose Yourself - Eminem', 'Can\'t Hold Us - Macklemore', 'Power - Kanye West', 'Run The World - Beyoncé']
    },
    {
        id: 'rainy-day',
        vibe: 'rainy-day',
        label: 'Rainy Day',
        emoji: '🌧️',
        tags: ['sad', 'chill'],
        plays: 0,
        platform: 'yt_music',
        songs: ['The Rain Song - Led Zeppelin', 'November Rain - Guns N Roses', 'Riders On The Storm - The Doors', 'Purple Rain - Prince', 'Let Her Go - Passenger', 'The Scientist - Coldplay', 'Skinny Love - Bon Iver', 'Shelter - Porter Robinson', 'Breathe - Pink Floyd', 'Wish You Were Here - Pink Floyd']
    },
    {
        id: 'party-mode',
        vibe: 'party-mode',
        label: 'Party Mode',
        emoji: '🎉',
        tags: ['party', 'hype'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Blinding Lights - The Weeknd', 'As It Was - Harry Styles', 'Levitating - Dua Lipa', 'Don\'t Start Now - Dua Lipa', 'Watermelon Sugar - Harry Styles', 'Save Your Tears - The Weeknd', 'Positions - Ariana Grande', 'drivers license - Olivia Rodrigo', 'good 4 u - Olivia Rodrigo', 'Kiss Me More - Doja Cat']
    },
    {
        id: 'lofi-study',
        vibe: 'lofi-study',
        label: 'Lofi Study',
        emoji: '📚',
        tags: ['lofi', 'focus'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Snowman - Petit Biscuit', 'Sunset Lover - Petit Biscuit', 'White Ferrari - Frank Ocean', 'Nights - Frank Ocean', 'Self Control - Frank Ocean', 'Intro - The xx', 'Together - Disclosure', 'Motion - Tycho', 'Awake - Tycho', 'A Walk - Tycho']
    },
    {
        id: 'road-trip',
        vibe: 'road-trip',
        label: 'Road Trip',
        emoji: '🚗',
        tags: ['road trip', 'chill'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Life is a Highway - Tom Cochrane', 'Born To Run - Bruce Springsteen', 'Take It Easy - Eagles', 'Go Your Own Way - Fleetwood Mac', 'Africa - Toto', 'Don\'t Stop Believin\' - Journey', 'Hotel California - Eagles', 'Sweet Home Alabama - Lynyrd Skynyrd', 'Fast Car - Tracy Chapman', 'Mr. Brightside - The Killers']
    },
    {
        id: 'cinematic',
        vibe: 'cinematic',
        label: 'Cinematic',
        emoji: '🎬',
        tags: ['instrumental', 'focus'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Time - Hans Zimmer', 'Experience - Ludovico Einaudi', 'Interstellar Main Theme - Hans Zimmer', 'Now We Are Free - Hans Zimmer', 'Comptine d\'un autre été - Yann Tiersen', 'Arrival of the Birds - The Cinematic Orchestra', 'To Build A Home - The Cinematic Orchestra', 'Spiegel im Spiegel - Arvo Part', 'Gymnopedie No.1 - Erik Satie', 'Clair de Lune - Debussy']
    },
    {
        id: 'old-school-hiphop',
        vibe: 'old-school-hiphop',
        label: 'Old School Hip-Hop',
        emoji: '🎤',
        tags: ['hiphop', '90s'],
        plays: 0,
        platform: 'yt_music',
        songs: ['Nuthin But A G Thang - Dr. Dre', 'Gin and Juice - Snoop Dogg', 'C.R.E.A.M. - Wu-Tang Clan', 'Juicy - The Notorious B.I.G.', 'Hypnotize - The Notorious B.I.G.', 'California Love - 2Pac', 'Changes - 2Pac', 'Shook Ones Pt. II - Mobb Deep', 'NY State of Mind - Nas', 'Protect Ya Neck - Wu-Tang Clan']
    },
    {
        id: 'romantic-evening',
        vibe: 'romantic-evening',
        label: 'Romantic Evening',
        emoji: '🕯️',
        tags: ['romance', 'chill'],
        plays: 0,
        platform: 'yt_music',
        songs: ['At Last - Etta James', 'La Vie en Rose - Edith Piaf', 'Can\'t Help Falling In Love - Elvis Presley', 'Make You Feel My Love - Adele', 'All of Me - John Legend', 'Perfect - Ed Sheeran', 'Thinking Out Loud - Ed Sheeran', 'Kiss Me - Ed Sheeran', 'Endless Love - Diana Ross', 'Unforgettable - Nat King Cole']
    },
];

exports.handler = async (event) => {
    // Simple auth key to prevent accidental re-seeding
    const key = event.queryStringParameters?.key;
    if (key !== 'pb-seed-2026') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized. Add ?key=pb-seed-2026' }) };
    }

    try {
        // Init Firebase Admin (uses service account from Netlify env vars)
        if (!getApps().length) {
            initializeApp({ credential: credential.applicationDefault() });
        }
        const db = getFirestore();

        const results = [];
        for (const vibe of VIBES) {
            const { id, ...data } = vibe;
            const ref = db.collection('vibes').doc(id);
            const existing = await ref.get();
            if (!existing.exists) {
                await ref.set(data);
                results.push(`✅ Seeded: ${id}`);
            } else {
                results.push(`⏭ Already exists: ${id}`);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, results })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
