// Import libraries
const puppeteer = require('puppeteer');
const fs = require("fs");
const locateChrome = require('locate-chrome');

// Function to find and click on an element
findAndClick = async (page, selector) => {
    await page.waitForSelector(selector);
    await page.click(selector);
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    return;
};

// Function to set text in a text field
// and return true if no text fields are found or false otherwise
setText = async (page, selector, text) => {
    
    let noTextFields = true;

    noTextFields = await page.evaluate((selector, text, noTextFields) => {
        const el = document.querySelector(selector);
        if(el) {
            noTextFields = false;
            document.querySelector(selector).innerText = text;
        }
        return noTextFields;
    }, selector, text, noTextFields);

    return noTextFields;
};

// Function to select options in a select box
// and return true if no select boxes are found or false otherwise
selectOptions = async (page, selector) => {
    let noSelectBoxes = true;

    for(let j = 0; j < 5; j++) {
        noSelectBoxes = await page.evaluate(async (selector, j, noSelectBoxes) => {
            const el = document.querySelector(selector + j);
            if(el) {
                noSelectBoxes = false;
                document.querySelector(selector + j + ' option:nth-child(1)').removeAttribute('selected');
                document.querySelector(selector + j + ' option:nth-child(2)').setAttribute("selected", '');
            }
            return noSelectBoxes;
        }, selector, j, noSelectBoxes);
    }

    return noSelectBoxes;
};

// Function to simulate checkout payment
simulateCheckout = async (page) => {
    // Go to cart page
    await page.goto('https://www.etsy.com/cart?ref=hdr-cart', {waitUntil: 'networkidle2'}).then(async () => {
        await page.screenshot({
            path: 'etsy-cart.png'
        });

        // Proceed to checkout
        await page.click('button.proceed-to-checkout');
        await page.screenshot({
            path: 'etsy-checkout.png'
        });

        // Continue as guest
        await findAndClick(page, 'div.wt-validation > button');
        await page.screenshot({
            path: 'etsy-guest.png'
        });
    });
};

// Main function
(async () => {

    // Find the path of the Chrome executable
    const executablePath = await new Promise(resolve => locateChrome(arg => resolve(arg)));
    // Launch browser and set options for preview and debugging
    const browser = await puppeteer.launch({ headless: false, executablePath, dumpio: true });
  
    // Create a page
    const page = await browser.newPage();

    //Set dimensions of viewpoint for browser page
    await page.setViewport({ width: 600, height: 1500 })
  
    // Go to site and wait for it to load until there are no more than 2 network connections for at least 500ms
    await page.goto('https://www.etsy.com', {waitUntil: 'networkidle2'});

    // Set the maximum navigation time to 500000ms which is 500 seconds
    page.setDefaultNavigationTimeout(500000);

    // Take a screenshot of main page
    await page.screenshot({
        path: 'etsy.png'
    });
  
    // Click on the first link of category elements and wait for the page to load
    await findAndClick(page, 'a.wt-card__action-link');

    // Take a screenshot of the first step
    await page.screenshot({
        path: 'etsy-1-step.png'
    });

    // Click on the second link of category elements and wait for the page to load
    await findAndClick(page, 'a.parent-hover-underline');

    // Take a screenshot of the second step
    await page.screenshot({
        path: 'etsy-2-step.png'
    });

    // Click on the third link of category elements and wait for the page to load
    await findAndClick(page, 'a.parent-hover-underline');
    
    // Take a screenshot of the third step
    await page.screenshot({
        path: 'etsy-3-step.png'
    });

    // Find all the rings on the page and set their names, prices and urls
    const names = await page.evaluate(() => Array.from(document.querySelectorAll('h2.wt-text-caption'), element => element.textContent));
    const prices = await page.evaluate(() => Array.from(document.querySelectorAll('span.currency-value'), element => element.textContent));
    const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a[href].listing-link'), element => element.getAttribute('href')));

    // Create a JSON object with the rings
    let rings = [];
    for(let i = 0; i < 10; i++) {
        let ring =
        {
            name: names[i].trim(),
            price: prices[i].trim(),
            url: urls[i]
        };
        rings.push(ring);
    }

    // Write the JSON object to a file
    fs.writeFile(
        "./db.json",
        JSON.stringify(rings),
        async err => {
            // Checking for errors 
            if (err) throw err;
    
            // After Success go trough the rings and add them to the cart if possible
            for(let i = 0; i < 10; i++) {

                // Go to the ring page and wait for it to load until there are no more than 2 network connections
                await page.goto(rings[i].url, {waitUntil: 'networkidle2'}).then(async () => {
                    // Set main part of selector for select boxes
                    let selector = 'select#variation-selector-';
                
                    // Select options
                    await selectOptions(page, selector).then(async (noSelectBoxes) => {
                        // Set selector for text fields
                        selector = 'textarea#listing-page-personalization-textarea';

                        // and set text in text fields
                        await setText(page, selector, "T").then(async (noTextFields) => {
                            // If there are no select boxes and no text fields, click on the add to cart button
                            if(noSelectBoxes && noTextFields)
                                await findAndClick(page, 'div[data-selector=add-to-cart-button] > button');

                            // Take a screenshot of the ring with selected options and added text
                            await page.screenshot({
                                path: 'ring'+i+'.png'
                            });
                        });
                    });
                });

            }

            // Simulate checkout payment
            await simulateCheckout(page);

            // Close the browser
            await browser.close();
        });
})();