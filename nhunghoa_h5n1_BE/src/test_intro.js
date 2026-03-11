const GAVANG_API = 'https://api-gavang.gvtv1.com';
const API_HEADERS = { 'Content-Type': 'application/json', 'Origin': 'https://xem1.gv05.live', 'Referer': 'https://xem1.gv05.live/' };

const INTROSPECTION = `{
  __type(name: "Match") {
    name
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}`;

async function test() {
    try {
        const res = await fetch(`${GAVANG_API}/matches/graph`, {
            method: 'POST', headers: API_HEADERS, body: JSON.stringify({ query: INTROSPECTION })
        });
        const json = await res.json();
        console.log(JSON.stringify(json, null, 2));
    } catch (e) { console.error(e); }
}
test();
