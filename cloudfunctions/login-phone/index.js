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
      await usersCollection.doc(existingUser._id).update({
        data: {
            updateTime: db.serverDate()
        }
      })
      console.log(`用户已存在，openid: ${openid}`)
    } else {
      existingStatus = false;
      userData = {
        _id: openid,
        openid: openid,
        avatar: "",
        campus: "",
        class_name: "",
        college: "",
        createTime: db.serverDate(),
        gender: "",
        name: "czy_test",
        password: "",
        phone: "",
        status: "active",
        stu_id: "",
        totalCount: 0,
        totalDistance: 0,
        totalDuration: 0,
        updateTime: db.serverDate(),
        violationCount: 0
      }
      const result = await usersCollection.add({
        data: userData
      })
      console.log(`新用户创建成功，openid: ${openid}`)
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
    console.error('登录失败:', error)
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
    console.error('查询用户失败:', error)
    throw new Error('查询用户信息失败')
  }
}