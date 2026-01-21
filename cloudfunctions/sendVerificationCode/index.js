// 云函数：发送短信验证码
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 生成6位随机验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

exports.main = async (event, context) => {
  const { phone } = event
  
  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return {
      success: false,
      code: 400,
      message: '手机号格式不正确'
    }
  }
  
  try {
    // 检查60秒内是否已发送过验证码
    const now = new Date().getTime()
    const oneMinuteAgo = now - 60000
    
    const recentCodes = await db.collection('VerificationCodes')
      .where({
        phone: phone,
        createTime: db.command.gte(oneMinuteAgo),
        used: false
      })
      .get()
    
    if (recentCodes.data.length > 0) {
      return {
        success: false,
        code: 429,
        message: '验证码已发送，请60秒后再试'
      }
    }
    
    // 生成验证码
    const code = generateCode()
    
    // 存储验证码到数据库（有效期10分钟）
    await db.collection('VerificationCodes').add({
      data: {
        phone: phone,
        code: code,
        used: false,
        createTime: now,
        expireTime: now + 600000, // 10分钟后过期
      }
    })
    
    // TODO: 这里接入实际的短信服务商API
    // 例如：腾讯云短信、阿里云短信等
    // 示例代码（需要根据实际短信服务商修改）：
    /*
    const tencentcloud = require("tencentcloud-sdk-nodejs")
    const SmsClient = tencentcloud.sms.v20210111.Client
    
    const client = new SmsClient({
      credential: {
        secretId: "YOUR_SECRET_ID",
        secretKey: "YOUR_SECRET_KEY",
      },
      region: "ap-guangzhou",
    })
    
    await client.SendSms({
      PhoneNumberSet: ["+86" + phone],
      SmsSdkAppId: "YOUR_APP_ID",
      SignName: "星轨Runner",
      TemplateId: "YOUR_TEMPLATE_ID",
      TemplateParamSet: [code, "10"],
    })
    */
    
    // 开发环境下，将验证码返回（生产环境应删除此行）
    console.log('验证码（仅供测试）:', code)
    
    return {
      success: true,
      code: 200,
      message: '验证码已发送',
      // 开发测试时可以返回验证码，生产环境务必删除下面这行
      devCode: code  // 生产环境删除此行！
    }
    
  } catch (error) {
    console.error('发送验证码失败:', error)
    return {
      success: false,
      code: 500,
      message: '发送失败，请稍后重试',
      error: error.toString()
    }
  }
}
