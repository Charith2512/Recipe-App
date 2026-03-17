async function test() {
    console.log("Testing Drink List (Category: Cocktail)...");
    try {
        const res = await fetch('http://127.0.0.1:5001/api/drinks/filter.php?c=Cocktail');
        if (!res.ok) {
            console.error("HTTP Error:", res.status, res.statusText);
            const text = await res.text();
            console.error("Response Body:", text);
            return;
        }
        const data = await res.json();
        console.log("Response Status:", res.status);
        if (data.drinks) {
            console.log(`Success! Found ${data.drinks.length} drinks.`);
            console.log("First drink:", data.drinks[0]);
        } else {
            console.log("Failed: No drinks found in response", data);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

test();
