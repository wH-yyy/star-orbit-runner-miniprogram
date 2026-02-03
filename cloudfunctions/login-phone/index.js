const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()
const usersCollection = db.collection("Users")

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const openid  = wxContext.OPENID
    const existingUser = await findUserByOpenid(openid)
    let existingStatus = null;
    let userData = null

    if (existingUser) {
      existingStatus = true
      userData = existingUser
    } else {
      existingStatus = false;
      userData = {
        _id: openid,
        openid: openid,
        campus: "",
        class_name: "",
        college: "",
        createTime: db.serverDate(),
        gender: "",
        name: "",
        password: "",
        phone: "",
        status: "active",
        stu_id: Math.floor(Math.random() * 9000000000 + 1000000000).toString(),
        totalCount: 0,
        totalDistance: 0,
        totalDuration: 0,
        updateTime: db.serverDate(),
        violationCount: 0
      }
      const result = await usersCollection.add({
        data: userData
      })
    }
    return {
      code: 200,
      message: "登录成功",
      data: {
        openid: openid,
        existingStatus: existingStatus,
        userInfo: userData
      }
    }    
  } catch (error) {
    return {
      code: -1,
      message: `登录失败,${error}`
    }
  }
}

async function findUserByOpenid(openid) {
  try {
    const result = await usersCollection
      .where({
        openid: openid,
      })
      .get()
    return result.data.length > 0 ? result.data[0] : null
  } catch (error) {
    throw new Error('查询用户信息失败')
  }
}