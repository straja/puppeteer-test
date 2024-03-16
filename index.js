const puppeteer = require('puppeteer');
const fs = require("fs");
const locateChrome = require('locate-chrome');

findAndClick = async (page, selector) => {
    await page.waitForSelector(selector);
    await page.click(selector);
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    return;
};

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

(async () => {
    // Launch the browser TODO straja
    const executablePath = await new Promise(resolve => locateChrome(arg => resolve(arg)));
    const browser = await puppeteer.launch({ headless: false, executablePath, dumpio: true });
  
    // Create a page
    const page = await browser.newPage();

    //Set viewpoint of browser page
    await page.setViewport({ width: 600, height: 1500 })
  
    // Go to site
    await page.goto('https://www.etsy.com', {waitUntil: 'networkidle2'});

    page.setDefaultNavigationTimeout(500000);

    await page.screenshot({
        path: 'etsy.png'
    });
  
    // Query for an element handle.
    await findAndClick(page, 'a.wt-card__action-link');

    await page.screenshot({
        path: 'etsy-1-step.png'
    });

    await findAndClick(page, 'a.parent-hover-underline');

    await page.screenshot({
        path: 'etsy-2-step.png'
    });

    await findAndClick(page, 'a.parent-hover-underline');
    
    await page.screenshot({
        path: 'etsy-3-step.png'
    });

    const names = await page.evaluate(() => Array.from(document.querySelectorAll('h2.wt-text-caption'), element => element.textContent));
    const prices = await page.evaluate(() => Array.from(document.querySelectorAll('span.currency-value'), element => element.textContent));
    const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a[href].listing-link'), element => element.getAttribute('href')));

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

    fs.writeFile(
        "./db.json",
        JSON.stringify(rings),
        async err => {
            // Checking for errors 
            if (err) throw err;
    
            // Success 
            for(let i = 0; i < 10; i++) {

                await page.goto(rings[i].url, {waitUntil: 'networkidle2'}).then(async () => {
                    let selector = 'select#variation-selector-';
                
                    await selectOptions(page, selector).then(async (noSelectBoxes) => {
                        selector = 'textarea#listing-page-personalization-textarea';

                        await setText(page, selector, "T").then(async (noTextFields) => {
                            if(noSelectBoxes && noTextFields)
                                await findAndClick(page, 'div[data-selector=add-to-cart-button] > button');

                            await page.screenshot({
                                path: 'ring'+i+'.png'
                            });
                        });
                    });
                });

            }

            await simulateCheckout(page);

            await browser.close();
        });
})();