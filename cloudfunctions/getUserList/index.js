// 云函数目录: cloudfunctions/getUserList/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { 
    page = 1, 
    pageSize = 10, 
    searchKeyword = '',
    searchFields = ['name', 'stu_id', 'class_name'],
    campus = [],
    college = [],
    gender = [] 
  } = event
  
  try {
    // 构建查询条件
    let query = {}
    
    // 搜索条件
    if (searchKeyword && searchKeyword.trim() !== '') {
      const orConditions = []
      
      if (searchFields.includes('name')) {
        orConditions.push({
          name: db.RegExp({
            regexp: searchKeyword,
            options: 'i'
          })
        })
      }
      
      if (searchFields.includes('stu_id')) {
        orConditions.push({
          stu_id: db.RegExp({
            regexp: searchKeyword,
            options: 'i'
          })
        })
      }
      
      if (searchFields.includes('class_name')) {
        orConditions.push({
          class_name: db.RegExp({
            regexp: searchKeyword,
            options: 'i'
          })
        })
      }
      
      if (orConditions.length > 0) {
        query = _.and([query, _.or(orConditions)])
      }
    }
    
    // 校区筛选 - 只在数组非空时添加条件
    if (campus && campus.length > 0 && campus[0] !== '') {
      query.campus = _.in(campus)
    }

    // 书院筛选
    if (college && college.length > 0 && college[0] !== '') {
      query.college = _.in(college)
    }

    // 性别筛选
    if (gender && gender.length > 0 && gender[0] !== '') {
      query.gender = _.in(gender)
    }
    
    // 计算总数
    const countResult = await db.collection('Users')
      .where(query)
      .count()
    
    const total = countResult.total
    
    // 计算分页
    const skip = (page - 1) * pageSize
    
    // 查询数据
    const res = await db.collection('Users')
      .where(query)
      .skip(skip)
      .limit(pageSize)
      .orderBy('createTime', 'desc')
      .get()
    
    const formatDuration = (duration) => {
      if (!duration || typeof duration !== 'object') {
        return '00:00:00';
      }
      const hour = duration.hour || 0;
      const minute = duration.minute || 0;
      const second = duration.second || 0;
      const pad = (num) => num.toString().padStart(2, '0');
      return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
    };

    // 处理数据，转换状态显示
    const data = res.data.map(user => {
      // 根据数字状态获取显示文本
      let statusText = '正常'
      if (user.status === 1) {
        statusText = '停跑'
      } else if (user.status === 2) {
        statusText = '封号'
      }

      return {
        ...user,
        status: user.status || 0,  // 确保状态有默认值
        statusText: statusText,     // 添加文本字段用于显示
        createTime: user.createTime ? 
          new Date(user.createTime).toISOString().split('T')[0] : '',
        totalDistance: user.totalDistance || 0,
        totalDuration: formatDuration(user.totalDuration),
        totalCount: user.totalCount || 0,
        violationCount: user.violationCount || 0
      }
    })
    
    return {
      success: true,
      data: {
        list: data,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }
    
  } catch (error) {
    console.error('获取用户列表失败:', error)
    return {
      success: false,
      message: error.message || '获取用户列表失败'
    }
  }
}