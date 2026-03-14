async function testApi() {
    try {
        const res = await fetch('http://localhost:8000/api/standings');
        const data = await res.json();
        console.log('API Success:', data.success);
        console.log('Leagues Count:', data.leagues ? data.leagues.length : 'missing');
        console.log('Navigation Count:', data.navigation ? data.navigation.length : 'missing');
        
        if (data.navigation && data.navigation.length > 0) {
            console.log('First Navigation Item:', data.navigation[0].name);
            console.log('Leagues in First Nav:', data.navigation[0].leagues.length);
        } else {
            console.log('WARNING: Navigation is EMPTY');
        }
    } catch (e) {
        console.error('API Test Error:', e.message);
    }
}

testApi();
