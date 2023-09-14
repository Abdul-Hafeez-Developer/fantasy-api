const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const path = require('path');
const { JSDOM } = require('jsdom');
const app = express();
app.use(bodyParser.json());
const PORT = 3000;


async function getTitle(page) {
  console.log("Getting page title...");
  await page.goto('https://sleeper.com/settings/profile');
  await page.waitForTimeout(5000);
  const pageTitle = (await page.title()).trim();
  console.log("Page Title => ", pageTitle);
  return pageTitle;
}

// (Start) Step1 - Login
async function login(email, password, page) {
  console.log("Logging in...");

  const emailField = await page.$('input[type="text"]');
  await emailField.type(email, { delay: 100 });
  await emailField.press('Enter');

  await page.waitForSelector('input[type="password"]');
  const passwordInput = await page.$('input[type="password"]');
  await passwordInput.type(password, { delay: 100 });
  await passwordInput.press('Enter');

  await page.waitForNavigation();
}

app.post('/login', async (req, res) => {
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: [
        '--start-maximized',
        '--user-data-dir=' + userDataDir,
      ],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      const { email, password } = req.body;
      await login(email, password, page);
      const newTitle = await getTitle(page);
      if (newTitle === "Sleeper - Sign Up or Login") {
        console.log("login fail");
        res.json({ status:false, data:'login fail' });
      } else {
        console.log("login success");
        res.json({ status:true, data:'login success' });
      }
    } else {
      console.log("already login");
      res.json({ status:true, data:'already login' });
    }

    await browser.close();
  } catch (error) {
    console.error('Error occurred during login:', error);
    res.json({ status:false, data:'An error occurred during login' });
  }
});
// (End) Step1 - Login







// (Start) Step2 - Select a League
async function selectLeague(page) {
  try {

    const leaguesData = await page.evaluate(async () => {
      const leaguesElements = Array.from(document.querySelectorAll('a.nav-league-item-wrapper'));
      const leaguesData = [];

      for (const leagueElement of leaguesElements) {
        leagueElement.click();
        await new Promise(resolve => setTimeout(resolve, 5000));

        const leagueHeaderElement = document.querySelector('div.left-header-row');
        const backgroundImageMatch = leagueHeaderElement.innerHTML.match(/background-image:\s*url\(&quot;(.*?)&quot;\)/);
        const backgroundImageUrl = backgroundImageMatch[1];

        const leagueName = leagueHeaderElement.querySelector('.name').textContent.trim();
        const leagueDescription = leagueHeaderElement.querySelector('.desc').textContent.trim();
        const currentUrl = window.location.href;
        const leagueId = currentUrl.match(/\/leagues\/(\d+)\/matchup/)[1];

        const leagueObject = {
          leagueId,
          backgroundImageUrl,
          leagueName,
          leagueDescription,
        };

        leaguesData.push(leagueObject);
      }

      return leaguesData;
    });

    return leaguesData;
  } catch (error) {
    console.error('Error occurred during selectLeague:', error);
    throw error;
  }
}

app.get('/selectLeague', async (req, res) => {
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: [
        '--start-maximized',
        '--user-data-dir=' + userDataDir,
      ],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("login failed");
      res.json({ status:false, data:'login failed' });
    }
    else
    {
      await page.goto('https://sleeper.com/leagues');
      await page.waitForTimeout(5000);
      const data = await selectLeague(page);
      console.log("selectLeague success data");
      res.json({ status:true, data:data });
    }

    await browser.close();

  } catch (error) {
    console.error('Error occurred during API request:', error);
    res.json({ status:false, data:'Internal server error' });
  }
});
// (End) Step2 - Select a League








// (Start) Step3 - Matchup
async function getMatchupWith(page) {
  try {
    const matchupData = [];
    const playerMatchupElements = await page.$$('div.matchup-owner-item');
    
    for (const playerMatchupElement of playerMatchupElements) {
      const teamName = await playerMatchupElement.$eval('.team-name', (element) => element.textContent);
      const name = await playerMatchupElement.$eval('.name', (element) => element.textContent);
      const percentage = await playerMatchupElement.$eval('.win-percentage-number', (element) => element.textContent);
      const projections = await playerMatchupElement.$eval('.projections', (element) => element.textContent);
      const score = await playerMatchupElement.$eval('.score', (element) => element.textContent);
      const description = await playerMatchupElement.$eval('.description', (element) => element.textContent);

      // Extract background-image URL from the style attribute
      const avatarElement = await playerMatchupElement.$('.avatar');
      const avatarStyle = await avatarElement.evaluate(element => element.getAttribute('style'));
      const backgroundImageUrlMatch = avatarStyle.match(/url\(['"]([^'"]+)['"]\)/);
      const avatarImageUrl = backgroundImageUrlMatch ? backgroundImageUrlMatch[1] : '';

      const data = {
        teamName,
        name,
        percentage,
        projections,
        score,
        description,
        avatarImageUrl,
      };
      matchupData.push(data);
    }

    return matchupData;
  } catch (error) {
    console.error('Error occurred during getMatchupWith:', error);
    throw error;
  }
}

async function getMatchups(page) {
  const playerArray1 = [];
  const playerArray2 = [];
  
  const matchupElements = await page.$$('div.player-section');
    
  const htmlDataStarters = await matchupElements[0].getProperty('outerHTML');
  const dom = new JSDOM(await htmlDataStarters.jsonValue());
  const containerElements = dom.window.document.querySelectorAll('.matchup-player-row-container');
  
  containerElements.forEach((containerElement, index) => {
    const player1 = containerElement.querySelector('.matchup-player-item:first-child');
    const player2 = containerElement.querySelector('.matchup-player-item:last-child');
    const playerData1 = getPlayerData(player1);
    const playerData2 = getPlayerData(player2);
    playerArray1.push(playerData1, playerData2);
  });

  const htmlDataBench = await matchupElements[1].getProperty('outerHTML');
  const dom2 = new JSDOM(await htmlDataBench.jsonValue());
  const containerElements2 = dom2.window.document.querySelectorAll('.matchup-player-row-container');
  
  containerElements2.forEach((containerElement, index) => {
    const player1 = containerElement.querySelector('.matchup-player-item:first-child');
    const player2 = containerElement.querySelector('.matchup-player-item:last-child');
    const playerData1 = getPlayerData(player1);
    const playerData2 = getPlayerData(player2);
    playerArray2.push(playerData1, playerData2);
  });

  return {
    playerArray1,
    playerArray2,
  };
}

function getPlayerData(playerElement) {
  const image = playerElement.querySelector('.player-image')?.getAttribute('data') || '';
  const name = playerElement.querySelector('.player-name div')?.textContent || '';
  const position = playerElement.querySelector('.player-pos')?.textContent || '';
  const projections = playerElement.querySelector('.projections')?.textContent || '';
  const rosterNickname = playerElement.querySelector('.roster-nickname')?.textContent || '';
  const description = playerElement.querySelector('.game-schedule-live-description')?.textContent || '';
  const yetPlay = playerElement.querySelector('.yet-to-play')?.textContent || '';
  return {
    image,
    name,
    position,
    projections,
    rosterNickname,
    yetPlay,
    description
  };
}

app.post('/getMatchups', async (req, res) => {
  const { leagueId } = req.body;
  console.log("getMatchups leagueId => ", leagueId);
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: [
        '--start-maximized',
        '--user-data-dir=' + userDataDir,
      ],
    };

    const { leagueId } = req.body;
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("login failed");
      res.json({ status:false, data:'login failed' });
    }
    else
    {
      await page.goto('https://sleeper.com/leagues/'+leagueId+'/matchup');
      await page.waitForTimeout(5000);
      const matchupWith = await getMatchupWith(page);
      const matchupsData = await getMatchups(page);
      const data = {
        matchupWith,
        matchupsData,
      };
      res.json({ status:true, data:data });
    }

    await browser.close();
  } catch (error) {
    console.error('Error occurred:', error);
    res.json({ status:false, data:'An error occurred'+error });
  }
});
// (End) Step3 - Matchup







// (Start) Step4 - Team
async function getTeamInfo(page) {
  try {
    const teamElements = await page.$$('div.user-tab-menu');
    const nameElement = await teamElements[0].$('div.name');
    const name = await nameElement.evaluate(element => element.textContent);
    const teamElementHTML = await teamElements[0].evaluate(element => element.outerHTML);
    const imageUrl = teamElementHTML.split('&quot;')[1];
    const teamObj = {
      name: name,
      imageUrl: imageUrl,
    };
    return teamObj;

  } catch (error) {
    console.error('Error occurred during getTeamInfo:', error);
    throw error;
  }
}

async function getTeams(page) {
  try {
    const playerInfo = [];
    const matchupElements = await page.$$('div.team-roster-item');

    for (const matchupElement of matchupElements) {
      const playerNameElement = await matchupElement.$('.player-name');
      const positionElement = await matchupElement.$('.pos');
      const byeWeekElement = await matchupElement.$('.bye-week');
      const slotPositionSquareElement = await matchupElement.$('.league-slot-position-square');
      const avatarElement = await matchupElement.$('.avatar-player');
      const nicknameElement = await matchupElement.$('.roster-nickname');
      const scheduleElement = await matchupElement.$('.game-schedule-live-description');
      const itemOptionElements = await matchupElement.$$('.item-option');

      if (!playerNameElement || !positionElement || !byeWeekElement) {
        console.warn('Skipping a player due to missing data.');
        continue;
      }

      const playerName = await playerNameElement.evaluate((element) => element.textContent);
      const position = await positionElement.evaluate((element) => element.textContent);
      const byeWeek = await byeWeekElement.evaluate((element) => element.textContent.trim());
      const slotPositionSquare = slotPositionSquareElement
        ? await slotPositionSquareElement.evaluate((element) => element.getAttribute('class'))
        : '';
      const avatarSrc = avatarElement
        ? await avatarElement.evaluate((element) => element.getAttribute('src'))
        : '';
      const nickname = nicknameElement
        ? await nicknameElement.evaluate((element) => element.textContent)
        : '';
      const schedule = scheduleElement
        ? await scheduleElement.evaluate((element) => element.textContent)
        : '';

      const itemOptions = [];
      for (const itemOptionElement of itemOptionElements) {
        const itemOptionContent = await itemOptionElement.evaluate((element) =>
          element.textContent.trim()
        );
        itemOptions.push(itemOptionContent);
      }

      const parts = position.split('-');
      const positionValue = parts[0].trim();
      const playerObj = {
        positionValue,
        playerName,
        position,
        byeWeek,
        slotPositionSquare,
        avatarSrc,
        nickname,
        schedule,
        itemOptions,
      };

      playerInfo.push(playerObj);
    }

    return playerInfo;
  } catch (error) {
    console.error('Error occurred during getTeams:', error);
    throw error;
  }
}

app.post('/getTeamInfo', async (req, res) => {
  const { leagueId } = req.body;
  console.log("getTeamInfo leagueId => ", leagueId);
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: ['--start-maximized', '--user-data-dir=' + userDataDir],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("login failed");
      res.status(200).json({ status:false, data:'login failed' });
    }
    else
    {
      await page.goto('https://sleeper.com/leagues/'+leagueId+'/team');
      await page.waitForTimeout(5000);
      const data = await getTeamInfo(page);
      res.json({ status:true, data:data });  
    }

    await browser.close();
  } catch (error) {
    console.error('Error occurred during getTeamInfo:', error);
    res.json({ status:false, data:'Error occurred during getTeamInfo'+error });
  }
});

app.post('/getTeams', async (req, res) => {
  const { leagueId } = req.body;
  console.log("getTeams leagueId => ", leagueId);

  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: ['--start-maximized', '--user-data-dir=' + userDataDir],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("login failed");
      res.status(200).json({ status:false, data:'login failed' });
    }
    else
    {
      await page.goto('https://sleeper.com/leagues/'+leagueId+'/team');
      await page.waitForTimeout(5000);
      const data = await getTeams(page);
      res.json({ status:true, data:data });
    }

    await browser.close();

  } catch (error) {
    console.error('Error occurred during getTeams:', error);
    res.json({ status:false, data:'Error occurred during getTeams'+error });
  }
});
// (End) Step4 - Team







// (Start) Step5 - League
async function getLeagueMatchups(page) {
  try {
    const matchupsData = [];
    const matchupElements = await page.$$('div.league-matchups');

    if (matchupElements.length > 0) {
      const htmlData = await matchupElements[0].getProperty('outerHTML');
      const htmlContent = await htmlData.jsonValue();
      const dom = new JSDOM(htmlContent);
      const matchupRowItems = dom.window.document.querySelectorAll('.league-matchup-row-item');

      matchupRowItems.forEach((matchupRowItem) => {
        const userElements = matchupRowItem.querySelectorAll('.user');

        userElements.forEach((userElement, index) => {
          const avatarElement = userElement.querySelector('.avatar');
          const teamNameElement = userElement.querySelector('.team-name');
          const nameElement = userElement.querySelector('.name');
          const scoreElement = userElement.querySelector('.score');
          const winPercentageElement = userElement.querySelector('.win-percentage-number');
          const descriptionElement = userElement.querySelector('.description');
          const projectionsElement = userElement.querySelector('.projections');

          const avatarStyle = avatarElement ? avatarElement.getAttribute('style') : '';
          const avatarSrcMatch = avatarStyle.match(/background-image:\s?url\("([^"]+)"\)/);
          const avatarSrc = avatarSrcMatch ? avatarSrcMatch[1] : '';
          const teamName = teamNameElement ? teamNameElement.textContent.trim() : '';
          const name = nameElement ? nameElement.textContent.trim() : '';
          const score = scoreElement ? scoreElement.textContent.trim() : '';
          const winPercentage = winPercentageElement ? winPercentageElement.textContent.trim() : '';
          const description = descriptionElement ? descriptionElement.textContent.trim() : '';
          const projections = projectionsElement ? projectionsElement.textContent.trim() : '';

          matchupsData.push({
            avatarSrc,
            teamName,
            name,
            score,
            winPercentage,
            description,
            projections,
          });
        });
      });
    }

    return matchupsData;
  } catch (error) {
    console.error('Error occurred during getMatchups:', error);
    throw error;
  }
}

async function getLeaguesData(page) {
  try {
    const leaguesData = [];
    const matchupElements = await page.$$('div.league-standing-list');

    if (matchupElements.length > 0) {
      const htmlData = await matchupElements[0].getProperty('outerHTML');
      const htmlContent = await htmlData.jsonValue();
      const dom = new JSDOM(htmlContent);
      const leaguesRowItems = dom.window.document.querySelectorAll('.league-standing-item');

      leaguesRowItems.forEach((leagueRowItem) => {
        const rankElement = leagueRowItem.querySelector('.rank');
        const avatarElement = leagueRowItem.querySelector('.avatar');
        const nameElement = leagueRowItem.querySelector('.name');
        const teamNameElement = leagueRowItem.querySelector('.team-name');
        const descriptionElement = leagueRowItem.querySelector('.description');

        const pfElement = Array.from(leagueRowItem.querySelectorAll('.standings-row .value.bold')).find(
          (el) => el.textContent.trim() === 'PF'
        );
        const paElement = Array.from(leagueRowItem.querySelectorAll('.standings-row .value.bold')).find(
          (el) => el.textContent.trim() === 'PA'
        );
        const waiverElement = Array.from(leagueRowItem.querySelectorAll('.standings-row .value.bold')).find(
          (el) => el.textContent.trim() === 'WAIVER'
        );

        const rank = rankElement ? rankElement.textContent.trim() : '';
        const avatarStyle = avatarElement ? avatarElement.getAttribute('style') : '';
        const avatarSrcMatch = avatarStyle.match(/background-image:\s?url\("([^"]+)"\)/);
        const avatarSrc = avatarSrcMatch ? avatarSrcMatch[1] : '';
        const name = nameElement ? nameElement.textContent.trim() : '';
        const teamName = teamNameElement ? teamNameElement.textContent.trim() : '';
        const description = descriptionElement ? descriptionElement.textContent.trim() : '';
        const pf = pfElement ? pfElement.nextElementSibling.textContent.trim() : '';
        const pa = paElement ? paElement.nextElementSibling.textContent.trim() : '';
        const waiver = waiverElement ? waiverElement.nextElementSibling.textContent.trim() : '';

        leaguesData.push({
          rank,
          avatarSrc,
          name,
          teamName,
          description,
          pf,
          pa,
          waiver,
        });
      });
    }

    return leaguesData;
  } catch (error) {
    console.error('Error occurred during getLeagues:', error);
    throw error;
  }
}

app.post('/getLeagueMatchups', async (req, res) => {
  const { leagueId } = req.body;
  console.log("getLeagueMatchups leagueId => ", leagueId);
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: [
        '--start-maximized',
        '--user-data-dir=' + userDataDir,
      ],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("login failed");
      res.status(200).json({ status:false, data:'login failed' });
    }
    else
    {
      await page.goto('https://sleeper.com/leagues/'+leagueId+'/league');
      await page.waitForTimeout(5000);
      const data = await getLeagueMatchups(page);
      res.json({ status:true, data:data });
    }

    await browser.close();
  } catch (error) {
    console.error('Error occurred during getLeagueMatchups:', error);
    res.json({ status:false, data:'Error occurred during getLeagueMatchups : '+error });
  }
});

app.post('/getLeaguesData', async (req, res) => {
  const { leagueId } = req.body;
  console.log("getLeaguesData leagueId => ", leagueId);
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: [
        '--start-maximized',
        '--user-data-dir=' + userDataDir,
      ],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("login failed");
      res.status(200).json({ status:false, data:'login failed' });
    }
    else
    {
      await page.goto('https://sleeper.com/leagues/'+leagueId+'/league');
      await page.waitForTimeout(5000);
      const data = await getLeaguesData(page);
      res.json({ status:true, data:data });
    }

    await browser.close();
  } catch (error) {
    console.error('Error occurred during getLeaguesData:', error);
    res.json({ status:false, data:'Error occurred during getLeaguesData : '+error });
  }
});
// (End) Step5 - League









// (Start) Step6 - Players
async function getPlayers(page) {
  try {
    const playersData = [];
    const playerElements = await page.$$('.player-list-item');

    for (const playerElement of playerElements) {
      const playerNameElement = await playerElement.$('.name');
      const playerPositionElement = await playerElement.$('.position');
      const playerGameScheduleElement = await playerElement.$('.game-schedule-live-description');
      const playerStatsCells = await playerElement.$$('.cell.all');

      const playerName = await playerNameElement.evaluate(el => el.textContent);
      const playerPosition = await playerPositionElement.evaluate(el => el.textContent);
      const playerGameSchedule = await playerGameScheduleElement.evaluate(el => el.textContent);

      const playerStats = [];
      for (const cell of playerStatsCells) {
        playerStats.push(await cell.evaluate(el => el.textContent));
      }

      const playerData = {
        name: playerName,
        position: playerPosition,
        gameSchedule: playerGameSchedule,
        stats: playerStats,
      };

      playersData.push(playerData);
    }

    return playersData;
  } catch (error) {
    console.error('Error occurred during getPlayers:', error);
    throw error;
  }
}

app.post('/getPlayers', async (req, res) => {
  const { leagueId } = req.body;
  console.log("getPlayers leagueId => ", leagueId);  
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: [
        '--start-maximized',
        '--user-data-dir=' + userDataDir,
      ],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("login failed");
      res.status(200).json({ status:false, data:'login failed' });
    }
    else
    {
      await page.goto('https://sleeper.com/leagues/'+leagueId+'/players');
      await page.waitForTimeout(5000);
      const data = await getPlayers(page);
      res.json({ status:true, data:data });
    }

    await browser.close();
  } catch (error) {
    console.error('Error occurred during getPlayers:', error);
    res.json({ status:false, data:'Error occurred during getPlayers : '+error });
  }
});
// (End) Step6 - Players







// (Start) Step7 - Logout
async function logout(page) {
  console.log("Logging out...");
  const logoutButton = await page.$('div.logout-text');

  if (logoutButton) {
    await logoutButton.click();
    await page.waitForTimeout(5000);
    return true;
  } else {
    return false;
  }
}

app.get('/logout', async (req, res) => {
  try {
    const userDataDir = path.join(__dirname, 'chrome-profile');
    const launchOptions = {
      headless: "new",
      args: [
        '--start-maximized',
        '--user-data-dir=' + userDataDir,
      ],
    };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    const pageTitle = await getTitle(page);
    if (pageTitle === "Sleeper - Sign Up or Login") {
      console.log("already logout");
      res.json({ status:true, data:'already logout' });
    }
    else
    {
      const logoutSuccess = await logout(page);
      if (logoutSuccess) {
        console.log("logout success");
        res.json({ status:true, data:'logout success' });
      } else {
        console.log("Error during logout");
        res.json({ status:false, data:'Error during logout' });
      }
    }

    await browser.close();
  } catch (error) {
    console.error('Error occurred during logout:', error);
    res.json({ status:false, data:'Error occurred during logout : '+error });
  }
});
// (End) Step7 - Logout




app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
