// 云函数：用户注册
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { 
    phone,           // 手机号
    stu_id,          // 学号
    name,            // 姓名
    gender,          // 性别
    campus,          // 校区
    class_name,      // 班级
    college,         // 书院
    code,            // 验证码
    password         // 密码
  } = event
  
  // 参数验证
  if (!phone || !stu_id || !name || !gender || !campus || !class_name || !college || !code || !password) {
    return {
      success: false,
      code: 400,
      message: '参数不完整'
    }
  }
  
  // 学号格式验证（10位数字）
  if (!/^\d{10}$/.test(stu_id)) {
    return {
      success: false,
      code: 400,
      message: '学号格式不正确'
    }
  }
  
  // 手机号格式验证
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return {
      success: false,
      code: 400,
      message: '手机号格式不正确'
    }
  }
  
  // 密码强度验证
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%&-_]{8,20}$/
  if (!passwordRegex.test(password)) {
    return {
      success: false,
      code: 400,
      message: '密码必须包含字母和数字，可包含@#$%&-_，长度8-20位'
    }
  }
  
  try {
    // 1. 验证验证码
    const now = new Date().getTime()
    const verificationResult = await db.collection('VerificationCodes')
      .where({
        phone: phone,
        code: code,
        used: false,
        expireTime: _.gte(now)
      })
      .get()
    
    if (verificationResult.data.length === 0) {
      return {
        success: false,
        code: 401,
        message: '验证码错误或已过期'
      }
    }
    
    // 2. 检查学号是否已被注册
    const studentIdCheck = await db.collection('Users')
      .where({
        stu_id: stu_id
      })
      .count()
    
    if (studentIdCheck.total > 0) {
      return {
        success: false,
        code: 409,
        message: '该学号已被注册'
      }
    }
    
    // 3. 检查手机号是否已被注册
    const phoneCheck = await db.collection('Users')
      .where({
        phone: phone
      })
      .count()
    
    if (phoneCheck.total > 0) {
      return {
        success: false,
        code: 409,
        message: '该手机号已被注册'
      }
    }
    
    // 4. 标记验证码为已使用
    await db.collection('VerificationCodes')
      .doc(verificationResult.data[0]._id)
      .update({
        data: {
          used: true,
          usedTime: now
        }
      })
    
    // 5. 创建用户记录 - 对应Users表所有字段
    const userResult = await db.collection('Users').add({
      data: {
        openid: wxContext.OPENID,              // 微信openid
        stu_id: stu_id,                        // 学号
        name: name,                            // 姓名
        gender: gender,                        // 性别
        campus: campus,                        // 校区
        class_name: class_name,                // 班级
        college: college,                      // 书院
        phone: phone,                          // 手机号
        password: password,                    // 密码（明文存储，需改进）
        avatar: '',                            // 头像URL（初始为空，用户后续可上传）
        createTime: db.serverDate(),           // 创建时间
        updateTime: db.serverDate(),           // 更新时间
        totalDistance: 0,                      // 总跑步距离（米）
        totalDuration: 0,                      // 总跑步时长（秒）
        totalCount: 0                          // 总跑步次数
      }
    })
    
    return {
      success: true,
      code: 200,
      message: '注册成功',
      data: {
        _id: userResult._id,
        stu_id: stu_id,
        name: name
      }
    }
    
  } catch (error) {
    console.error('注册失败:', error)
    return {
      success: false,
      code: 500,
      message: '注册失败，请稍后重试',
      error: error.toString()
    }
  }
}
