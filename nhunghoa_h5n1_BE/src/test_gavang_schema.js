const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://xem1.gv05.live',
    'Referer': 'https://xem1.gv05.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const query = `
  query IntrospectionQuery {
    __schema {
      types {
        name
        fields {
          name
        }
      }
    }
  }
`;

async function test() {
    try {
        console.log('Fetching full GraphQL schema...');
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({ query })
        });
        const json = await res.json();
        if (json.errors) {
            console.error('GraphQL Errors:', JSON.stringify(json.errors, null, 2));
            return;
        }
        const types = json.data.__schema.types;
        
        let found = false;
        types.forEach(t => {
            if (t.fields) {
                const names = t.fields.map(f => f.name);
                if (names.includes('team_1') || names.includes('is_live')) {
                    console.log(`Found type ${t.name}:`, names.join(', '));
                    found = true;
                }
            }
        });
        
        if (!found) {
            console.log('Could not find Match type. Showing all type names:');
            console.log(types.map(t => t.name).join(', '));
        }
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
