const ContestPoolMock = artifacts.require("./mocks/ContestPoolMock.sol");
const dateUtil = require('./DateUtil');
const t = require('./TestUtil').title;
const { getScore, parseToInt } = require('./ScoreUtil');

contract('ContestPoolWinning', accounts => {
    let contestPoolInstance;
    let owner = accounts[9];
    let manager = accounts[0];
    let player1 = accounts[1];
    let player2 = accounts[2];

    let startTime = dateUtil.toMillis(2018, 6, 1)
    let endTime = dateUtil.toMillis(2018, 6, 10);
    let graceTime = 1 * 86400;

    const maxBalance = web3.toWei(1, 'ether');
    const amountPerPlayer = web3.toWei(0.3, "ether");
    const contribution = web3.toWei(0.3, "ether");
    const prizeValue = web3.toWei(0.05, "ether");
    const managerCommission = web3.toWei(0.03, "ether");

    const predictionStr = "01111101 11100100 00100111 10011110 01010001 01101010 00100000 00111010 10001010 10000111 00100100 11100011 00010010 11000111 01011001 10101101 ";
    const prediction = parseToInt(predictionStr);

    const resultStr = "01010101 11100100 00100111 10011110 01010001 01101010 00100000 00111010 10001010 10000111 00100100 11100011 00010010 11000111 01011001 10101101 ";
    const result = parseToInt(resultStr);


    beforeEach('setup contract for each test', async () => {
        contestPoolInstance = await ContestPoolMock.new(
            owner,
            manager,
            "Rusia2018",
            startTime,
            endTime,
            graceTime,
            maxBalance,
            amountPerPlayer
        );
    });

    xit(t('anUser', 'publishScore', 'Player should be able to publish score'), async () => {
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 12));

        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
        //start the contest
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 6, 5));
        // setting mock results
        await contestPoolInstance.setMockResults(result, 4);
        
        const success = await contestPoolInstance.publishHighScore();

        const playerScore = await contestPoolInstance.highScore();

        assert(success, "should update score to high score");
    });

    it(t('anUser', 'claimThePrize', 'Winner should be able to claim prize.'), async () => {

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 12));

        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});

        const initialBalancePlayer1 = web3.eth.getBalance(player1).toNumber();

        await contestPoolInstance.addWinner(player1, prizeValue, {from: manager});

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 7, 12));

        await contestPoolInstance.claimThePrize({from: player1});
        const finalBalancePlayer1 = web3.eth.getBalance(player1).toNumber();

        assert(initialBalancePlayer1 < finalBalancePlayer1);

    });

    it(t('anUser', 'claimThePrize', 'Winner should not be able to claim prize before endTime.', true), async () => {

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 10));

        const initialBalancePlayer1 = web3.eth.getBalance(player1).toNumber();

        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});

        await contestPoolInstance.addWinner(player1, prizeValue, {from: owner});

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 6, 10));
        try {
            const result = await contestPoolInstance.claimThePrize({from: player1});
            assert(false, 'It should have failed because end date.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }
    });

    it(t('anUser', 'claimThePrize', 'A non winner should not be able to claim prize', true), async () => {

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 10));

        const initialBalancePlayer1 = web3.eth.getBalance(player1).toNumber();

        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});

        await contestPoolInstance.addWinner(player1, prizeValue, {from: owner});
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 7, 10));
        try {
            const result = await contestPoolInstance.claimThePrize({from: player2});
            assert(false, 'it should have failed because address is not a winner.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }
    });

    it(t('allWinners', 'claimThePrize', 'All winners should be able to claim prize'), async () => {

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));

        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
        await contestPoolInstance.sendPrediction(prediction, {from: player2, value: contribution});

        const initialBalancePlayer1 = web3.eth.getBalance(player1).toNumber();
        const initialBalancePlayer2 = web3.eth.getBalance(player2).toNumber();

        await contestPoolInstance.addWinner(player1, prizeValue, {from: owner});
        await contestPoolInstance.addWinner(player2, prizeValue, {from: owner});
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 7, 12));

        await contestPoolInstance.claimThePrize({from: player1});
        await contestPoolInstance.claimThePrize({from: player2});

        const finalBalancePlayer1 = web3.eth.getBalance(player1).toNumber();
        const finalBalancePlayer2 = web3.eth.getBalance(player2).toNumber();

        assert(initialBalancePlayer1 < finalBalancePlayer1);
        assert(initialBalancePlayer2 < finalBalancePlayer2);
    });

    it(t('aWinner', 'claimThePrize', 'Winner should not be able to claim prize twice', false), async () => {
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));
        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 7, 12));
        const initialBalancePlayer1 = web3.eth.getBalance(player1).toNumber();
        await contestPoolInstance.addWinner(player1, prizeValue, {from: owner});

        await contestPoolInstance.claimThePrize({from: player1});
        const finalBalancePlayer1 = web3.eth.getBalance(player1).toNumber();

        assert(initialBalancePlayer1 < finalBalancePlayer1);
        try {
            const result = await contestPoolInstance.claimThePrize({from: player1});
            assert(false, 'It should have failed. Winner can claim the prize only once.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }
    });
    
    it(t('aPlayer', 'sendPrediction', 'Should take contributions from players'), async () => {
        const contribution = web3.toWei(0.3, "ether");
        const predictionStr = "01111111 11100100 00100111 10011110 01010001 01101010 00100000 00111010 10001010 10000111 00100100 11100011 00010010 11000111 01011001 10101101 ";
        const prediction = parseToInt(predictionStr);
        const initialBalance = web3.eth.getBalance(contestPoolInstance.address).toNumber()

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));

        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});

        const contractPrediction = await contestPoolInstance.predictions(player1);
        const finalBalance = web3.eth.getBalance(contestPoolInstance.address).toNumber();

        assert.equal(contractPrediction.toNumber(), prediction, "Prediction for player 1 should be " + prediction);
        assert.equal(initialBalance + contribution, finalBalance);
    });

    it(t('aPlayer', 'sendPrediction', 'Should not be able to contributes twice.', true), async () => {
        const contribution = web3.toWei(0.3, "ether");
        const predictionStr = "01111111 11100100 00100111 10011110 01010001 01101010 00100000 00111010 10001010 10000111 00100100 11100011 00010010 11000111 01011001 10101101 ";
        const prediction = parseToInt(predictionStr);
        const initialBalance = web3.eth.getBalance(contestPoolInstance.address).toNumber()

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));
        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
        const finalBalance = web3.eth.getBalance(contestPoolInstance.address).toNumber();

        try {
            await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
            assert(false, "should have failed when trying to contribute two times ");
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
            assert.equal(initialBalance + contribution, finalBalance);
        }
    });

    it(t('aPlayer', 'sendPrediction', 'Should not able to take contributions higher than max balance.', true), async () => {
        const contribution = web3.toWei(2, "ether");//Max Balance: 1 eth
        const predictionStr = "01111111 11100100 00100111 10011110 01010001 01101010 00100000 00111010 10001010 10000111 00100100 11100011 00010010 11000111 01011001 10101101 ";
        const prediction = parseInt(predictionStr, 2);
        const initialBalance = web3.eth.getBalance(contestPoolInstance.address).toNumber()

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));

        try {
            await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
            asser(false, 'It should have failed because contribution is higher than max balance.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }
    });

    it(t('aPlayer', 'sendPrediction', 'Should not able to take contributions equals to max balance.', true), async () => {
        const contribution = web3.toWei(1, "ether");//Max Balance: 1 eth
        const predictionStr = "01111111 11100100 00100111 10011110 01010001 01101010 00100000 00111010 10001010 10000111 00100100 11100011 00010010 11000111 01011001 10101101 ";
        const prediction = parseInt(predictionStr, 2);

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));

        try {
            await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
            asser(false, 'It should have failed because contribution is higher than max balance.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }
    });

    it(t('aManager', 'sendPrediction', 'Should not be able to contribute to his contest pool.', true), async () => {
        const contribution = web3.toWei(0.2, "ether");
        const predictionStr = "01111111 11100100 00100111 10011110 01010001 01101010 00100000 00111010 10001010 10000111 00100100 11100011 00010010 11000111 01011001 10101101 ";
        const prediction = parseInt(predictionStr, 2);

        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));
        try {
            await contestPoolInstance.sendPrediction(prediction, {from: manager, value: contribution});
            assert(false, 'It should have failed because a manager must not participate in his own contest pool.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }
    });

    it(t('aManager', 'claimCommissionByManager', 'Should not be able to claim commission before all winner have claimed the prize', true), async () => {
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));
        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 7, 12));
        await contestPoolInstance.addWinner(player1, prizeValue, {from: owner});

        // await contestPoolInstance.claimThePrize({from: player1});
        try {
            await contestPoolInstance.claimCommissionByManager({from: manager});
            assert(false, 'It should have failed because a manager can not claim his commission before the winners.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }
    });

    it(t('aManager', 'claimCommissionByManager', 'Should  be able to claim commission after all winner have claimed the prize'), async () => {
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));
        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 7, 12));

        const managerInitialBalance = web3.eth.getBalance(manager).toNumber();

        await contestPoolInstance.addWinner(player1, prizeValue, {from: owner});
        await contestPoolInstance.addPayment(manager, managerCommission, {from: owner});
        await contestPoolInstance.claimThePrize({from: player1});

        await contestPoolInstance.claimCommissionByManager({from: manager});

        const managerFinalBalance = web3.eth.getBalance(manager).toNumber();
        assert(managerFinalBalance > managerInitialBalance);

    });

    it(t('theOwner', 'claimCommissionByOwner', 'Owner should  be able to claim commission'), async () => {
        await contestPoolInstance.setCurrentTime(dateUtil.toMillis(2018, 5, 1));
        await contestPoolInstance.sendPrediction(prediction, {from: player1, value: contribution});
        await contestPoolInstance.sendPrediction(prediction, {from: player2, value: contribution});
        const managerInitialBalance = web3.eth.getBalance(owner).toNumber();

        await contestPoolInstance.addPayment(owner, managerCommission, {from: owner});

        await contestPoolInstance.claimCommissionByOwner({from: owner});

        const managerFinalBalance = web3.eth.getBalance(owner).toNumber();

        assert(managerFinalBalance > managerInitialBalance);

    });

    it(t('theOwner', 'claimCommissionByOwner', 'Owner should not be able to claim commission without enough balance', true), async () => {

        await contestPoolInstance.addPayment(owner, managerCommission, {from: owner});

        try {
            await contestPoolInstance.claimCommissionByOwner({from: owner});
            assert(false, 'It should have failed because there is not enough balance to claim the commission.');
        } catch (error) {
            assert(error);
            assert(error.message.includes("revert"));
        }


    });
});
