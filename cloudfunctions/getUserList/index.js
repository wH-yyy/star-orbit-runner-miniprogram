// 云函数目录: cloudfunctions/getUserList/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const {
    page = 1,
      pageSize = 10,
      searchKeyword = '',
      searchFields = ['name', 'stu_id', 'class_name'],
      campus = [],
      college = [],
      status = []
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

    // 状态筛选
    if (status && status.length > 0 && status[0] !== '') {
      query.status = _.in(status)
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

    return {
      success: true,
      data: {
        list: res.data,
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