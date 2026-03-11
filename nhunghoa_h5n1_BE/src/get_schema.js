const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = { 'Content-Type': 'application/json', 'Origin': 'https://xem1.gv05.live', 'Referer': 'https://xem1.gv05.live/' };

const INTROSPECTION = `{
  __type(name: "Match") {
    fields {
      name
    }
  }
}`;

async function test() {
    try {
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST', headers: API_HEADERS, body: JSON.stringify({ query: INTROSPECTION })
        });
        const json = await res.json();
        const fields = json.data.__type.fields.map(f => f.name);
        console.log("FIELDS:", fields.join(', '));
    } catch (e) { console.error(e); }
}
test();
