const shuffle = list => {
    for (let i = list.length - 1; i > 0; i--) {
        const random = Math.floor(Math.random() * (i + 1));
        const tmp = list[i];
        list[i] = list[random];
        list[random] = tmp;
    }
    return list;
};

const fromHardcoded = ({userID = '0', username, userUrlType = 'github'}) => {
    const result = {
        // image: `https://avatars.githubusercontent.com/u/${userID}`,
        text: username
    };
    if (username && userID !== '0') {
        if(userUrlType === 'github'){
            result.image = `https://avatars.githubusercontent.com/u/${userID}`;
            result.href = `https://github.com/${username}/`;
        }else if(userUrlType === 'bilibili'){
            result.image = `/static/credits/${userID}.webp`;  
            result.href = `https://space.bilibili.com/${userID}/`;
        }
        
    }
    return result;
};

// The lists below are in no particular order.

const contributors = [
    {
        userUrlType: 'github',
        userID: '148440803',
        username: 'RyaninCn11'
    },
    {
        userUrlType: 'github',
        userID: '67349469',
        username: 'TurboWarp'
    },
    {
        userUrlType: 'github',
        userID: '175630084',
        username: 'MistWarp'
    },
    {
        userUrlType: 'github',
        userID: '244335609',
        username: 'AstraEditor'
    },
    {
        userUrlType: 'github',
        userID: '273910431',
        username: 'DLGrass'
    },
].map(fromHardcoded);

const addonDevelopers = [
    {
        userUrlType: 'github',
        userID: '148440803',
        username: 'RyaninCn11'
    },
    {
        userUrlType: 'github',
        userID: '67349469',
        username: 'TurboWarp'
    },
    {
        userUrlType: 'github',
        userID: '175630084',
        username: 'MistWarp'
    }
].map(fromHardcoded);

const extensionDevelopers = [
    {
        userUrlType: 'bilibili',
        username: 'MR醉诗',
        userID: '3546960701163977',
        // userImage:'https://i1.hdslb.com/bfs/face/594b7c3a597f9f5bf3e66e384feb1d17ce7387cb.jpg@128w_128h_1c_1s.webp'
    },
    {
        userUrlType: 'github',
        userID: '273910431',
        username: 'DLGrass'
    },
    {   
        userUrlType: 'bilibili',
        username: '蓝立方Blue3',
        userID:'25786611',
        // userImage:'https://i1.hdslb.com/bfs/face/62a30dec6dc1aa1e319db1e77e5e948fd37e85e3.jpg@128w_128h_1c_1s.webp', 
    },
    {
        userUrlType: 'github',
        userID: '148440803',
        username: 'RyaninCn11'
    },
    {
        userUrlType: 'bilibili',
        username: '勇敢的菠萝🍍',
        userID:'521949499',
    },
    // {
    //     userUrlType: 'github',
    //     username: 'Kimos Frontender',
    //     userID: '180540701'
    // }
].map(fromHardcoded);

const docs = [
    {
        userUrlType: 'github',
        userID: '148440803',
        username: 'RyaninCn11'
    },
    {
        userUrlType: 'github',
        userID: '273910431',
        username: 'DLGrass'
    },
    {
        userUrlType: 'github',
        userID: '67349469',
        username: 'TurboWarp'
    },
    {
        userUrlType: 'github',
        userID: '175630084',
        username: 'MistWarp'
    }
].map(fromHardcoded);

const translators = [
    {
        userUrlType: 'github',
        userID: '148440803',
        username: 'RyaninCn11'
    },
    {
        userUrlType: 'github',
        userID: '273910431',
        username: 'DLGrass'
    },
    {
        userUrlType: 'github',
        userID: '67349469',
        username: 'TurboWarp'
    },
    // {
    //     userUrlType: 'github',
    //     userID: '175630084',
    //     username: 'MistWarp'
    // }
].map(fromHardcoded);

export default {
    contributors: shuffle(contributors),
    addonDevelopers: shuffle(addonDevelopers),
    extensionDevelopers: shuffle(extensionDevelopers),
    docs: shuffle(docs),
    translators: shuffle(translators)
};
